import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { calendar as getCalendar } from 'googleapis/build/src/apis/calendar';
import { prisma } from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { env } from '../../config/env';
import { EncryptionService } from '../../utils/EncryptionService';
import { getCalendarPlanLimits } from '../../config/plans';

export const CALENDAR_UNAVAILABLE_SAFE_INSTRUCTION =
  'Calendar integration is unavailable or not connected. Do NOT tell the caller that the calendar is not connected, unavailable, or failed. Do NOT mention systems, calendars, databases, or technical errors. Instead, naturally propose a specific time or acknowledge their preferred time with "noted", and inform them the team will follow up to confirm the slot.';

export interface FreeSlot {
  id: string;
  startIso: string;
  endIso: string;
  spokenLabel: string;
}

export interface SchedulingRuleConfig {
  agentId?: string;
  calendarConnectionId?: string | null;
  timeZone: string;
  workingDays: number[]; // 0 = Sun, 1 = Mon ...
  workingHours: { start: string; end: string } | Array<{ start: string; end: string }>;
  appointmentMinutes: number;
  bufferBeforeAfterMinutes: number;
  minNoticeMinutes: number;
  maxDaysAhead: number;
  maxBookingsPerDay: number;
  blackoutDates: string[]; // YYYY-MM-DD
  treatAllDayEventsAsBusy: boolean;
  allowedCalendars: string[];
  attendeeMode: string;
  addMeetLink: boolean;
  instructions?: string | null;
}

export class CalendarService {
  private static freeBusyCache = new Map<string, { data: any; expiresAt: number }>();
  private static calendarLocks = new Map<string, Promise<void>>();
  private static workspaceApiCallTimestamps = new Map<string, number[]>();

  private static getOauth2Client() {
    return new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID || env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET || env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || env.GOOGLE_REDIRECT_URI || `${env.FRONTEND_URL}/api/v2/calendar/callback`
    );
  }

  /**
   * Decrypts and safely parses Google OAuth tokens.
   * Handles versioned "v2:..." encrypted payloads and legacy plaintext JSON strings.
   * Returns null if unparseable, empty, or marked revoked.
   */
  static getDecryptedTokens(rawTokens: string | null | undefined): any | null {
    if (!rawTokens || typeof rawTokens !== 'string') return null;
    let jsonStr = rawTokens.trim();
    if (jsonStr.startsWith('v2:')) {
      const decrypted = EncryptionService.decrypt(jsonStr);
      if (!decrypted) return null;
      jsonStr = decrypted.trim();
    }
    try {
      const tokens = JSON.parse(jsonStr);
      if (!tokens || typeof tokens !== 'object') return null;
      if (tokens.access_token === 'revoked' || tokens.refresh_token === 'revoked') {
        return null;
      }
      return tokens;
    } catch {
      return null;
    }
  }

  /**
   * Resolves the active calendar connection for a workspace.
   * Prioritizes active tokens while keeping user.googleCalendarTokens and calendar_connections aligned.
   */
  static async getConnectionForWorkspace(workspaceId: string): Promise<any | null> {
    if (!workspaceId) return null;
    try {
      const user = await prisma.user.findUnique({
        where: { id: workspaceId },
        select: { googleCalendarTokens: true, email: true }
      });

      const conn = await prisma.calendarConnection.findUnique({
        where: { workspaceId }
      });

      if (user?.googleCalendarTokens) {
        const uTokens = this.getDecryptedTokens(user.googleCalendarTokens);
        if (uTokens) {
          return {
            id: conn?.id || 'legacy',
            workspaceId,
            provider: 'google',
            googleEmail: conn?.googleEmail || user.email || 'user@claritiyvoice.com',
            encryptedTokens: user.googleCalendarTokens,
            scopes: conn?.scopes || 'https://www.googleapis.com/auth/calendar.freebusy https://www.googleapis.com/auth/calendar.events',
            status: 'healthy',
            lastCheckedAt: new Date()
          };
        }
      }

      if (conn && conn.status !== 'revoked') {
        return conn;
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Executes a Google API call with a hard timeout budget and single retry on 5xx/429 with jitter.
   */
  private static async withTimeoutAndRetry<T>(
    operation: () => Promise<T>,
    timeoutMs: number = 1500,
    maxRetries: number = 1
  ): Promise<T> {
    let attempt = 0;
    while (true) {
      attempt++;
      let timer: NodeJS.Timeout | null = null;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('GOOGLE_API_TIMEOUT')), timeoutMs);
      });

      try {
        const result = await Promise.race([operation(), timeoutPromise]);
        if (timer) clearTimeout(timer);
        return result;
      } catch (err: any) {
        if (timer) clearTimeout(timer);
        const status = err?.status || err?.code;
        const isRetryable =
          err?.message === 'GOOGLE_API_TIMEOUT' ||
          status === 429 ||
          (typeof status === 'number' && status >= 500 && status < 600);

        if (attempt <= maxRetries && isRetryable) {
          const jitter = Math.floor(Math.random() * 150) + 100;
          await new Promise((r) => setTimeout(r, jitter));
          continue;
        }
        throw err;
      }
    }
  }

  /**
   * Per-workspace rate limiting guard.
   */
  private static checkWorkspaceRateLimit(workspaceId: string, limitPerMin: number = 30): boolean {
    const now = Date.now();
    const windowStart = now - 60000;
    let timestamps = this.workspaceApiCallTimestamps.get(workspaceId) || [];
    timestamps = timestamps.filter((t) => t > windowStart);
    if (timestamps.length >= limitPerMin) {
      return false;
    }
    timestamps.push(now);
    this.workspaceApiCallTimestamps.set(workspaceId, timestamps);
    return true;
  }

  /**
   * Concurrency lock per calendar ID to eliminate race conditions during event bookings.
   */
  private static async acquireCalendarLock(calendarId: string): Promise<() => void> {
    while (this.calendarLocks.has(calendarId)) {
      await this.calendarLocks.get(calendarId);
    }
    let unlock: () => void = () => {};
    const lockPromise = new Promise<void>((resolve) => {
      unlock = () => {
        this.calendarLocks.delete(calendarId);
        resolve();
      };
    });
    this.calendarLocks.set(calendarId, lockPromise);
    return unlock;
  }

  /**
   * Verifies if workspace has a valid, healthy Google Calendar connection.
   */
  static async hasConnectedCalendar(workspaceId?: string | null): Promise<boolean> {
    try {
      if (!workspaceId) return false;

      // Check user record first to catch any revoked tokens in legacy/test overrides
      const user = await prisma.user.findUnique({
        where: { id: workspaceId },
        select: { googleCalendarTokens: true }
      });
      if (user?.googleCalendarTokens) {
        const uTokens = this.getDecryptedTokens(user.googleCalendarTokens);
        if (!uTokens) return false;
      }

      const conn = await this.getConnectionForWorkspace(workspaceId);
      if (!conn || conn.status !== 'healthy') return false;

      const tokens = this.getDecryptedTokens(conn.encryptedTokens);
      if (!tokens) return false;
      if (!tokens.access_token && !tokens.refresh_token) return false;

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clears the in-memory free/busy cache (used on disconnect or booking).
   */
  static clearCache(): void {
    this.freeBusyCache.clear();
  }

  /**
   * Fetches or constructs default scheduling rules for an agent.
   */
  static async getSchedulingRule(agentId?: string | null, workspaceId?: string | null): Promise<SchedulingRuleConfig> {
    const defaultRule: SchedulingRuleConfig = {
      agentId: agentId || undefined,
      timeZone: 'Asia/Kolkata',
      workingDays: [1, 2, 3, 4, 5], // Mon-Fri
      workingHours: { start: '09:00', end: '17:00' },
      appointmentMinutes: 30,
      bufferBeforeAfterMinutes: 10,
      minNoticeMinutes: 120, // 2 hours
      maxDaysAhead: 30,
      maxBookingsPerDay: 8,
      blackoutDates: [],
      treatAllDayEventsAsBusy: true,
      allowedCalendars: ['primary'],
      attendeeMode: 'invite_caller',
      addMeetLink: false,
      instructions: null,
    };

    if (!agentId) return defaultRule;

    try {
      const dbRule = await prisma.agentSchedulingRule.findUnique({
        where: { agentId }
      });
      if (!dbRule) return defaultRule;

      return {
        agentId: dbRule.agentId,
        calendarConnectionId: dbRule.calendarConnectionId,
        timeZone: dbRule.timeZone || 'Asia/Kolkata',
        workingDays: JSON.parse(dbRule.workingDays || '[1,2,3,4,5]'),
        workingHours: JSON.parse(dbRule.workingHours || '{"start":"09:00","end":"17:00"}'),
        appointmentMinutes: dbRule.appointmentMinutes || 30,
        bufferBeforeAfterMinutes: dbRule.bufferBeforeAfterMinutes || 10,
        minNoticeMinutes: dbRule.minNoticeMinutes || 120,
        maxDaysAhead: dbRule.maxDaysAhead || 30,
        maxBookingsPerDay: dbRule.maxBookingsPerDay || 8,
        blackoutDates: JSON.parse(dbRule.blackoutDates || '[]'),
        treatAllDayEventsAsBusy: dbRule.treatAllDayEventsAsBusy,
        allowedCalendars: JSON.parse(dbRule.allowedCalendars || '["primary"]'),
        attendeeMode: dbRule.attendeeMode || 'invite_caller',
        addMeetLink: dbRule.addMeetLink || false,
        instructions: dbRule.instructions || null,
      };
    } catch {
      return defaultRule;
    }
  }

  /**
   * Converts a given local date and time in a target IANA timezone into an exact UTC Date object.
   * DST-safe across daylight transitions (e.g. America/New_York) and fractional offsets (e.g. Asia/Kolkata).
   */
  static localToUtc(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): Date {
    const approx = new Date(Date.UTC(year, month - 1, day, hour, minute));
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false
    });
    const parts = dtf.formatToParts(approx);
    const p: Record<string, number> = {};
    for (const part of parts) {
      if (part.type !== 'literal') p[part.type] = parseInt(part.value, 10);
    }
    const asLocalMs = Date.UTC(p.year, p.month - 1, p.day, p.hour === 24 ? 0 : p.hour, p.minute, p.second || 0);
    const offsetMs = asLocalMs - approx.getTime();
    return new Date(approx.getTime() - offsetMs);
  }

  /**
   * Formats a local slot date and time into a natural spoken label for the caller.
   * Examples: "tomorrow at 11 am", "Friday at 2:30 pm", "next Monday at 10 am".
   */
  static formatSpokenLabel(slotDate: Date, timeZone: string): string {
    const now = new Date();
    const dtfTz = (date: Date) => {
      const dtf = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        weekday: 'long',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
      });
      const parts = dtf.formatToParts(date);
      const res: Record<string, string> = {};
      for (const p of parts) res[p.type] = p.value;
      return res;
    };

    const slotParts = dtfTz(slotDate);
    const nowParts = dtfTz(now);

    const slotDayNum = parseInt(slotParts.day, 10);
    const nowDayNum = parseInt(nowParts.day, 10);
    const slotMonthNum = parseInt(slotParts.month, 10);
    const nowMonthNum = parseInt(nowParts.month, 10);

    const diffDays = Math.round((slotDate.getTime() - now.getTime()) / (86400000));

    let dayPrefix = `${slotParts.weekday}`;
    if (slotDayNum === nowDayNum && slotMonthNum === nowMonthNum) {
      dayPrefix = 'today';
    } else if (diffDays >= 0 && diffDays <= 1) {
      dayPrefix = 'tomorrow';
    } else if (diffDays > 1 && diffDays <= 6) {
      dayPrefix = `${slotParts.weekday}`;
    } else {
      dayPrefix = `${slotParts.weekday}, ${slotParts.month}/${slotParts.day}`;
    }

    const minute = parseInt(slotParts.minute, 10);
    const timeStr = minute === 0
      ? `${slotParts.hour} ${slotParts.dayPeriod?.toLowerCase() || ''}`
      : `${slotParts.hour}:${slotParts.minute.padStart(2, '0')} ${slotParts.dayPeriod?.toLowerCase() || ''}`;

    return `${dayPrefix} at ${timeStr.trim()}`;
  }

  /**
   * Queries free/busy intervals with transient 25-second caching and timeout budget.
   */
  static async checkAvailability(workspaceId: string, startTime: string, endTime: string, calendarId: string = 'primary'): Promise<any> {
    try {
      if (!workspaceId) {
        return {
          success: false,
          error: 'CALENDAR_NOT_CONNECTED',
          needsReauth: false,
          flagFollowUpNeeded: true,
          instruction: CALENDAR_UNAVAILABLE_SAFE_INSTRUCTION,
        };
      }

      const conn = await this.getConnectionForWorkspace(workspaceId);
      if (!conn || conn.status !== 'healthy') {
        return {
          success: false,
          error: 'CALENDAR_NOT_CONNECTED',
          needsReauth: conn?.status === 'needs_reauth',
          flagFollowUpNeeded: true,
          instruction: CALENDAR_UNAVAILABLE_SAFE_INSTRUCTION,
        };
      }

      const tokens = this.getDecryptedTokens(conn.encryptedTokens);
      if (!tokens) {
        logger.warn('[CALENDAR_AUTH_FAILED] Revoked or invalid tokens encountered during checkAvailability', { workspaceId });
        await prisma.calendarConnection.updateMany({
          where: { workspaceId },
          data: { status: 'needs_reauth', lastErrorCode: 'INVALID_TOKENS' }
        }).catch(() => {});
        return {
          success: false,
          error: 'CALENDAR_NOT_CONNECTED',
          needsReauth: true,
          flagFollowUpNeeded: true,
          instruction: 'I will note your preferred time and our team will follow up directly to confirm the appointment.'
        };
      }

      const userPlan = await prisma.user.findUnique({
        where: { id: workspaceId },
        select: { accountType: true }
      });
      const limits = getCalendarPlanLimits(userPlan?.accountType);

      if (!this.checkWorkspaceRateLimit(workspaceId, limits.apiCallsPerMinute)) {
        logger.warn('CalendarService: Workspace Google API rate limit exceeded', { workspaceId });
        return {
          success: false,
          error: 'RATE_LIMIT_EXCEEDED',
          flagFollowUpNeeded: true,
          instruction: CALENDAR_UNAVAILABLE_SAFE_INSTRUCTION,
        };
      }

      // Check in-memory 25s cache
      const cacheKey = `${workspaceId}:${calendarId}:${startTime}:${endTime}`;
      const cached = this.freeBusyCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        const busySlots = cached.data;
        return { success: true, available: busySlots.length === 0, busySlots };
      }

      const oauth2Client = this.getOauth2Client();
      oauth2Client.setCredentials(tokens);

      const calendar = (getCalendar as any)({ version: 'v3', auth: oauth2Client });

      const res = await this.withTimeoutAndRetry(async () => {
        return await calendar.freebusy.query({
          requestBody: {
            timeMin: startTime,
            timeMax: endTime,
            items: [{ id: calendarId }],
          }
        });
      }, 1500, 1);

      const busy = res.data.calendars?.[calendarId]?.busy || [];

      // Store in transient cache
      this.freeBusyCache.set(cacheKey, {
        data: busy,
        expiresAt: Date.now() + 25 * 1000,
      });

      return { success: true, available: busy.length === 0, busySlots: busy };
    } catch (error: any) {
      logger.error('Failed to check calendar availability', { error: error.message, workspaceId });
      const isAuthError = error?.message?.includes('invalid_grant') || error?.code === 401 || error?.status === 401;

      if (isAuthError) {
        await prisma.calendarConnection.updateMany({
          where: { workspaceId },
          data: { status: 'needs_reauth', lastErrorCode: 'OAUTH_INVALID_GRANT' }
        }).catch(() => {});
      }

      return {
        success: false,
        error: isAuthError ? 'CALENDAR_AUTH_FAILED' : 'CALENDAR_CHECK_FAILED',
        needsReauth: isAuthError,
        flagFollowUpNeeded: true,
        instruction: 'I will note your preferred time and our team will follow up directly to confirm the appointment.'
      };
    }
  }

  /**
   * Computes up to 3 ranked free appointment slots based on agent scheduling rules and Google free/busy calendar.
   */
  static async getFreeSlots(
    workspaceId: string,
    agentId?: string,
    options?: {
      fromDate?: string;
      toDate?: string;
      partOfDay?: string; // 'morning' | 'afternoon' | 'evening'
      durationMinutes?: number;
    }
  ): Promise<FreeSlot[]> {
    try {
      const conn = await this.getConnectionForWorkspace(workspaceId);
      if (!conn || conn.status !== 'healthy') return [];

      const rule = await this.getSchedulingRule(agentId, workspaceId);
      const tz = rule.timeZone || 'Asia/Kolkata';

      const duration = options?.durationMinutes || rule.appointmentMinutes || 30;
      const buffer = rule.bufferBeforeAfterMinutes || 10;
      const slotStepMinutes = duration + buffer;

      const now = new Date();
      const minNoticeMs = (rule.minNoticeMinutes || 120) * 60 * 1000;
      const earliestAllowedUtc = new Date(now.getTime() + minNoticeMs);

      // Determine date search bounds
      const maxDays = Math.min(rule.maxDaysAhead || 30, 30);
      const searchStart = options?.fromDate ? new Date(options.fromDate) : now;
      const searchEnd = options?.toDate
        ? new Date(options.toDate)
        : new Date(searchStart.getTime() + 7 * 86400000);

      const cappedEnd = new Date(Math.min(searchEnd.getTime(), now.getTime() + maxDays * 86400000));

      // Fetch Google free/busy for the entire range (1 cached call)
      const primaryCalendarId = rule.allowedCalendars?.[0] || 'primary';
      const freeBusyRes = await this.checkAvailability(
        workspaceId,
        searchStart.toISOString(),
        cappedEnd.toISOString(),
        primaryCalendarId
      );

      const busyIntervals: Array<{ start: number; end: number }> = (freeBusyRes.busySlots || []).map((b: any) => ({
        start: new Date(b.start).getTime(),
        end: new Date(b.end).getTime()
      }));

      // Count existing bookings per day for daily cap
      const existingBookings = await prisma.calendarBooking.findMany({
        where: {
          workspaceId,
          startUtc: { gte: searchStart, lte: cappedEnd },
          status: { in: ['confirmed', 'rescheduled'] }
        },
        select: { startUtc: true }
      });

      const bookingsCountByDate = new Map<string, number>();
      for (const b of existingBookings) {
        const dStr = b.startUtc.toISOString().slice(0, 10);
        bookingsCountByDate.set(dStr, (bookingsCountByDate.get(dStr) || 0) + 1);
      }

      const shifts: Array<{ start: string; end: string }> = Array.isArray(rule.workingHours)
        ? rule.workingHours
        : [rule.workingHours];

      const candidateSlots: FreeSlot[] = [];

      // Iterate through each day in the search window (up to 7 days ahead)
      for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
        const dayCursor = new Date(searchStart.getTime() + dayOffset * 86400000);
        if (dayCursor > cappedEnd) break;

        // Extract year, month, day, dayOfWeek in target timeZone
        const dtf = new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          year: 'numeric',
          month: 'numeric',
          day: 'numeric',
          weekday: 'short'
        });
        const parts = dtf.formatToParts(dayCursor);
        const p: Record<string, string> = {};
        for (const pt of parts) p[pt.type] = pt.value;

        const y = parseInt(p.year, 10);
        const m = parseInt(p.month, 10);
        const d = parseInt(p.day, 10);

        // Day of week mapping: Sun=0, Mon=1...
        const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
        const dayOfWeek = weekdayMap[p.weekday] ?? 0;

        if (!rule.workingDays.includes(dayOfWeek)) continue;

        const dateIsoStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        if (rule.blackoutDates && rule.blackoutDates.includes(dateIsoStr)) continue;

        // Daily cap enforcement
        const dailyCount = bookingsCountByDate.get(dateIsoStr) || 0;
        if (dailyCount >= (rule.maxBookingsPerDay || 8)) continue;

        // Generate slots for each configured working shift
        for (const shift of shifts) {
          const [startHour, startMin] = shift.start.split(':').map((x) => parseInt(x, 10));
          const [endHour, endMin] = shift.end.split(':').map((x) => parseInt(x, 10));

          const shiftStartUtc = this.localToUtc(y, m, d, startHour, startMin, tz);
          const shiftEndUtc = this.localToUtc(y, m, d, endHour, endMin, tz);

          let slotStartUtc = shiftStartUtc;
          while (slotStartUtc.getTime() + duration * 60 * 1000 <= shiftEndUtc.getTime()) {
            const slotEndUtc = new Date(slotStartUtc.getTime() + duration * 60 * 1000);

            // Minimum notice check
            if (slotStartUtc >= earliestAllowedUtc) {
              const sTime = slotStartUtc.getTime();
              const eTime = slotEndUtc.getTime();

              // Check overlap with busy intervals including buffers
              const hasConflict = busyIntervals.some((b) => {
                const bStart = b.start - buffer * 60 * 1000;
                const bEnd = b.end + buffer * 60 * 1000;
                return sTime < bEnd && eTime > bStart;
              });

              if (!hasConflict) {
                const spokenLabel = this.formatSpokenLabel(slotStartUtc, tz);
                candidateSlots.push({
                  id: `slot_${sTime}`,
                  startIso: slotStartUtc.toISOString(),
                  endIso: slotEndUtc.toISOString(),
                  spokenLabel,
                });
              }
            }

            slotStartUtc = new Date(slotStartUtc.getTime() + slotStepMinutes * 60 * 1000);
          }
        }
      }

      // Ranking based on user preference: morning, afternoon, evening
      const partOfDay = options?.partOfDay?.toLowerCase();
      candidateSlots.sort((a, b) => {
        const dateA = new Date(a.startIso);
        const dateB = new Date(b.startIso);

        if (partOfDay) {
          const hourA = dateA.getUTCHours();
          const hourB = dateB.getUTCHours();

          const score = (h: number) => {
            if (partOfDay === 'morning' && h >= 4 && h < 7) return 10; // ~9:30-12:30 IST
            if (partOfDay === 'afternoon' && h >= 7 && h < 12) return 10;
            if (partOfDay === 'evening' && h >= 12) return 10;
            return 0;
          };

          const diff = score(hourB) - score(hourA);
          if (diff !== 0) return diff;
        }

        return dateA.getTime() - dateB.getTime();
      });

      return candidateSlots.slice(0, 3);
    } catch (err: any) {
      logger.error('Failed to compute free slots', { error: err.message, workspaceId });
      return [];
    }
  }

  /**
   * Schedules a confirmed calendar booking with double-booking lock, idempotency, attendee info, and timezone safety.
   */
  static async bookAppointment(params: {
    workspaceId: string;
    agentId?: string;
    slotId: string;
    callerName: string;
    callerPhone?: string;
    callerEmail?: string;
    notes?: string;
    callId?: string;
    idempotencyKey?: string;
  }): Promise<any> {
    const {
      workspaceId,
      agentId,
      slotId,
      callerName,
      callerPhone,
      callerEmail,
      notes,
      callId,
      idempotencyKey = params.idempotencyKey || (callId ? `${callId}_${slotId}` : `direct_${crypto.randomBytes(8).toString('hex')}_${slotId}`),
    } = params;

    // 1. Idempotency Check: if booking with this idempotency key already exists, return confirmed record
    try {
      const existing = await prisma.calendarBooking.findUnique({
        where: { idempotencyKey }
      });
      if (existing) {
        return {
          status: 'confirmed',
          bookingId: existing.id,
          eventId: existing.googleEventId,
          startUtc: existing.startUtc.toISOString(),
          endUtc: existing.endUtc.toISOString(),
          idempotent: true
        };
      }
    } catch {
      // Continue to fresh booking
    }

    const conn = await this.getConnectionForWorkspace(workspaceId);
    if (!conn || conn.status !== 'healthy') {
      return {
        status: 'failed',
        error: 'CALENDAR_NOT_CONNECTED',
        instruction: CALENDAR_UNAVAILABLE_SAFE_INSTRUCTION,
      };
    }

    const rule = await this.getSchedulingRule(agentId, workspaceId);
    const calendarId = rule.allowedCalendars?.[0] || 'primary';
    const releaseLock = await this.acquireCalendarLock(calendarId);

    try {
      // Decode slot time from slotId (format: slot_<timestampMs>)
      const slotMs = parseInt(slotId.replace(/^slot_/, ''), 10);
      const slotStart = isNaN(slotMs) ? new Date() : new Date(slotMs);
      const slotEnd = new Date(slotStart.getTime() + (rule.appointmentMinutes || 30) * 60 * 1000);

      // Re-verify availability under calendar lock to prevent double bookings
      const availCheck = await this.checkAvailability(workspaceId, slotStart.toISOString(), slotEnd.toISOString(), calendarId);
      if (availCheck.success && !availCheck.available) {
        logger.warn('CalendarService: Slot taken just before booking (race condition mitigated)', { slotId, workspaceId });
        const alternatives = await this.getFreeSlots(workspaceId, agentId);
        return {
          status: 'slot_taken',
          message: 'That slot was just booked by another caller.',
          alternatives: alternatives.slice(0, 2),
        };
      }

      const tokens = this.getDecryptedTokens(conn.encryptedTokens);
      const oauth2Client = this.getOauth2Client();
      oauth2Client.setCredentials(tokens);

      const calendar = (getCalendar as any)({ version: 'v3', auth: oauth2Client });
      const targetTz = rule.timeZone || 'Asia/Kolkata';

      let fullDescription = notes || '';
      if (callerName || callerPhone || callerEmail) {
        fullDescription += `\n\nCaller Information:\n- Name: ${callerName || 'Valued Caller'}\n- Phone: ${callerPhone || 'Not provided'}\n- Email: ${callerEmail || 'Not provided'}`;
      }
      if (callId) {
        fullDescription += `\n- Claritiy Voice Call Session: ${callId}`;
      }

      const attendees = [];
      if (callerEmail && rule.attendeeMode === 'invite_caller') {
        attendees.push({ email: callerEmail, displayName: callerName || undefined });
      }

      // Generate deterministic Google Event ID derived from idempotencyKey
      const eventIdHash = crypto.createHash('md5').update(idempotencyKey).digest('hex');
      const googleEventId = `cv_${eventIdHash}`;

      const eventPayload: any = {
        id: googleEventId,
        summary: `Appointment with ${callerName || 'Caller'}`,
        description: fullDescription.trim(),
        start: {
          dateTime: slotStart.toISOString(),
          timeZone: targetTz,
        },
        end: {
          dateTime: slotEnd.toISOString(),
          timeZone: targetTz,
        },
        attendees: attendees.length > 0 ? attendees : undefined,
      };

      if (rule.addMeetLink) {
        eventPayload.conferenceData = {
          createRequest: {
            requestId: idempotencyKey,
            conferenceSolutionKey: { type: 'hangoutsMeet' }
          }
        };
      }

      const event = await this.withTimeoutAndRetry(async () => {
        return await calendar.events.insert({
          calendarId,
          conferenceDataVersion: rule.addMeetLink ? 1 : undefined,
          requestBody: eventPayload,
        });
      }, 2500, 1);

      // Record in calendar_bookings table
      let bookingRecord: any = null;
      try {
        bookingRecord = await prisma.calendarBooking.create({
          data: {
            workspaceId,
            agentId: agentId || workspaceId,
            callId: callId || null,
            calendarConnectionId: conn.id !== 'legacy' ? conn.id : null,
            googleEventId: event.data.id || googleEventId,
            calendarId,
            startUtc: slotStart,
            endUtc: slotEnd,
            timeZone: targetTz,
            status: 'confirmed',
            callerName: callerName || 'Valued Caller',
            callerPhone: callerPhone || null,
            callerEmail: callerEmail || null,
            notes: notes || null,
            idempotencyKey,
          }
        });
      } catch (dbErr: any) {
        logger.error('Error inserting calendar_booking row', { error: dbErr.message, idempotencyKey });
      }

      // Invalidate free/busy cache
      this.clearCache();

      // Write call event record for AnalysisService / Reports sync
      if (callId) {
        try {
          await prisma.callEvent.create({
            data: {
              callId,
              eventType: 'tool_call',
              payload: JSON.stringify({
                toolName: 'schedule_event',
                success: true,
                bookingId: bookingRecord?.id,
                eventId: event.data.id,
                startTime: slotStart.toISOString(),
                endTime: slotEnd.toISOString()
              })
            }
          });
        } catch {
          // Non-blocking
        }
      }

      return {
        status: 'confirmed',
        bookingId: bookingRecord?.id,
        eventId: event.data.id,
        eventLink: event.data.htmlLink,
        startUtc: slotStart.toISOString(),
        endUtc: slotEnd.toISOString(),
      };
    } catch (error: any) {
      logger.error('Failed to book appointment', { error: error.message, workspaceId, idempotencyKey });
      return {
        status: 'failed',
        error: 'CALENDAR_BOOKING_FAILED',
        flagFollowUpNeeded: true,
        instruction: 'I have noted your appointment details and our team will follow up directly to confirm.'
      };
    } finally {
      releaseLock();
    }
  }

  /**
   * Reschedules an existing appointment booking to a new available slot.
   */
  static async rescheduleAppointment(params: {
    workspaceId: string;
    bookingId: string;
    slotId: string;
    callId?: string;
    callerPhone?: string;
  }): Promise<any> {
    const { workspaceId, bookingId, slotId, callerPhone } = params;

    const booking = await prisma.calendarBooking.findUnique({
      where: { id: bookingId }
    });
    if (!booking || booking.workspaceId !== workspaceId) {
      return { status: 'failed', error: 'BOOKING_NOT_FOUND' };
    }

    // Phone / caller validation
    if (callerPhone && booking.callerPhone && booking.callerPhone !== callerPhone) {
      return { status: 'failed', error: 'UNAUTHORIZED_CALLER' };
    }

    const conn = await this.getConnectionForWorkspace(workspaceId);
    if (!conn) return { status: 'failed', error: 'CALENDAR_NOT_CONNECTED' };

    const calendarId = booking.calendarId || 'primary';
    const releaseLock = await this.acquireCalendarLock(calendarId);

    try {
      const slotMs = parseInt(slotId.replace(/^slot_/, ''), 10);
      const newStart = isNaN(slotMs) ? new Date() : new Date(slotMs);
      const durationMs = booking.endUtc.getTime() - booking.startUtc.getTime();
      const newEnd = new Date(newStart.getTime() + durationMs);

      // Check slot availability
      const avail = await this.checkAvailability(workspaceId, newStart.toISOString(), newEnd.toISOString(), calendarId);
      if (avail.success && !avail.available) {
        return { status: 'slot_taken', message: 'The requested reschedule slot is no longer available.' };
      }

      const tokens = this.getDecryptedTokens(conn.encryptedTokens);
      const oauth2Client = this.getOauth2Client();
      oauth2Client.setCredentials(tokens);
      const calendar = (getCalendar as any)({ version: 'v3', auth: oauth2Client });

      if (booking.googleEventId) {
        await calendar.events.patch({
          calendarId,
          eventId: booking.googleEventId,
          requestBody: {
            start: { dateTime: newStart.toISOString(), timeZone: booking.timeZone },
            end: { dateTime: newEnd.toISOString(), timeZone: booking.timeZone }
          }
        });
      }

      const updated = await prisma.calendarBooking.update({
        where: { id: bookingId },
        data: {
          startUtc: newStart,
          endUtc: newEnd,
          status: 'rescheduled'
        }
      });

      this.clearCache();
      return {
        status: 'rescheduled',
        bookingId: updated.id,
        startUtc: newStart.toISOString(),
        endUtc: newEnd.toISOString()
      };
    } catch (err: any) {
      logger.error('Failed to reschedule appointment', { error: err.message, bookingId });
      return { status: 'failed', error: 'RESCHEDULE_FAILED' };
    } finally {
      releaseLock();
    }
  }

  /**
   * Cancels an existing appointment booking.
   */
  static async cancelAppointment(params: {
    workspaceId: string;
    bookingId: string;
    callId?: string;
    callerPhone?: string;
  }): Promise<any> {
    const { workspaceId, bookingId, callerPhone } = params;

    const booking = await prisma.calendarBooking.findUnique({
      where: { id: bookingId }
    });
    if (!booking || booking.workspaceId !== workspaceId) {
      return { status: 'failed', error: 'BOOKING_NOT_FOUND' };
    }

    if (callerPhone && booking.callerPhone && booking.callerPhone !== callerPhone) {
      return { status: 'failed', error: 'UNAUTHORIZED_CALLER' };
    }

    const conn = await this.getConnectionForWorkspace(workspaceId);
    const calendarId = booking.calendarId || 'primary';
    const releaseLock = await this.acquireCalendarLock(calendarId);

    try {
      if (conn && booking.googleEventId) {
        try {
          const tokens = this.getDecryptedTokens(conn.encryptedTokens);
          const oauth2Client = this.getOauth2Client();
          oauth2Client.setCredentials(tokens);
          const calendar = (getCalendar as any)({ version: 'v3', auth: oauth2Client });

          await calendar.events.delete({
            calendarId,
            eventId: booking.googleEventId
          });
        } catch (eventErr: any) {
          logger.warn('Could not delete Google Calendar event during cancellation', { error: eventErr.message });
        }
      }

      await prisma.calendarBooking.update({
        where: { id: bookingId },
        data: { status: 'cancelled' }
      });

      this.clearCache();
      return { status: 'cancelled', bookingId };
    } catch (err: any) {
      logger.error('Failed to cancel appointment', { error: err.message, bookingId });
      return { status: 'failed', error: 'CANCEL_FAILED' };
    } finally {
      releaseLock();
    }
  }

  /**
   * Backwards compatible legacy scheduleEvent wrapper.
   */
  static async scheduleEvent(
    userId: string,
    summary: string,
    startTime: string,
    endTime: string,
    description?: string,
    timezone?: string,
    options?: {
      calendarId?: string;
      callerName?: string;
      callerPhone?: string;
      callerEmail?: string;
      idempotencyKey?: string;
      callId?: string;
    }
  ): Promise<any> {
    const slotId = `slot_${new Date(startTime).getTime()}`;
    const res = await this.bookAppointment({
      workspaceId: userId,
      slotId,
      callerName: options?.callerName || summary || 'Caller',
      callerPhone: options?.callerPhone,
      callerEmail: options?.callerEmail,
      notes: description,
      callId: options?.callId,
      idempotencyKey: options?.idempotencyKey,
    });

    if (res.status === 'confirmed') {
      return {
        success: true,
        eventId: res.eventId,
        eventLink: res.eventLink,
        status: 'confirmed',
      };
    } else if (res.status === 'slot_taken') {
      return {
        success: false,
        error: 'SLOT_ALREADY_TAKEN',
        instruction: 'That time slot was just booked. Let me propose another time that works for you.',
      };
    }
    return {
      success: false,
      error: res.error || 'CALENDAR_SCHEDULE_FAILED',
      instruction: res.instruction || 'I have noted your details and our team will reach out to finalize your booking.',
    };
  }
}

