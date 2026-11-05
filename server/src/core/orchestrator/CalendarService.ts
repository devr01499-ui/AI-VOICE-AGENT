import { OAuth2Client } from 'google-auth-library';
import { calendar as getCalendar } from 'googleapis/build/src/apis/calendar';
import { prisma } from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { env } from '../../config/env';
import { EncryptionService } from '../../utils/EncryptionService';

export const CALENDAR_UNAVAILABLE_SAFE_INSTRUCTION =
  'Calendar integration is unavailable or not connected. Do NOT tell the caller that the calendar is not connected, unavailable, or failed. Do NOT mention systems, calendars, databases, or technical errors. Instead, naturally propose a specific time or acknowledge their preferred time with "noted", and inform them the team will follow up to confirm the slot.';

export interface FreeSlot {
  id: string;
  startIso: string;
  endIso: string;
  spokenLabel: string;
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
   * Per-workspace rate limiting guard (max 30 requests per minute).
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
   * Verifies if user has a valid, non-revoked Google Calendar connection.
   */
  static async hasConnectedCalendar(userId?: string | null): Promise<boolean> {
    try {
      if (!userId) return false;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { googleCalendarTokens: true }
      });
      if (!user?.googleCalendarTokens) return false;

      const tokens = this.getDecryptedTokens(user.googleCalendarTokens);
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
   * Queries free/busy intervals with transient 25-second caching and timeout budget.
   */
  static async checkAvailability(userId: string, startTime: string, endTime: string, calendarId: string = 'primary'): Promise<any> {
    try {
      if (!userId) {
        return {
          success: false,
          error: 'CALENDAR_NOT_CONNECTED',
          needsReauth: false,
          flagFollowUpNeeded: true,
          instruction: CALENDAR_UNAVAILABLE_SAFE_INSTRUCTION,
        };
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { googleCalendarTokens: true }
      });

      if (!user?.googleCalendarTokens) {
        return {
          success: false,
          error: 'CALENDAR_NOT_CONNECTED',
          needsReauth: false,
          flagFollowUpNeeded: true,
          instruction: CALENDAR_UNAVAILABLE_SAFE_INSTRUCTION,
        };
      }

      const tokens = this.getDecryptedTokens(user.googleCalendarTokens);
      if (!tokens) {
        logger.warn('[CALENDAR_AUTH_FAILED] Revoked or invalid tokens encountered during checkAvailability', { userId });
        return {
          success: false,
          error: 'CALENDAR_NOT_CONNECTED',
          needsReauth: true,
          flagFollowUpNeeded: true,
          instruction: 'I will note your preferred time and our team will follow up directly to confirm the appointment.'
        };
      }

      if (!this.checkWorkspaceRateLimit(userId)) {
        logger.warn('CalendarService: Workspace Google API rate limit exceeded', { userId });
        return {
          success: false,
          error: 'RATE_LIMIT_EXCEEDED',
          flagFollowUpNeeded: true,
          instruction: CALENDAR_UNAVAILABLE_SAFE_INSTRUCTION,
        };
      }

      // Check in-memory 25s cache
      const cacheKey = `${userId}:${calendarId}:${startTime}:${endTime}`;
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
      logger.error('Failed to check calendar availability', { error: error.message, userId });
      const isAuthError = error?.message?.includes('invalid_grant') || error?.code === 401 || error?.status === 401;

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
   * Schedules a confirmed calendar event with double-booking lock, idempotency, attendee info, and timezone safety.
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
    const calendarId = options?.calendarId || 'primary';
    const releaseLock = await this.acquireCalendarLock(calendarId);

    try {
      if (!userId) {
        return {
          success: false,
          error: 'CALENDAR_NOT_CONNECTED',
          instruction: CALENDAR_UNAVAILABLE_SAFE_INSTRUCTION,
        };
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { googleCalendarTokens: true }
      });

      if (!user?.googleCalendarTokens) {
        return {
          success: false,
          error: 'CALENDAR_NOT_CONNECTED',
          instruction: CALENDAR_UNAVAILABLE_SAFE_INSTRUCTION,
        };
      }

      const tokens = this.getDecryptedTokens(user.googleCalendarTokens);
      if (!tokens) {
        logger.warn('[CALENDAR_AUTH_FAILED] Invalid or revoked tokens during scheduleEvent', { userId });
        return {
          success: false,
          error: 'CALENDAR_NOT_CONNECTED',
          needsReauth: true,
          flagFollowUpNeeded: true,
          instruction: 'I will note your preferred time and our team will follow up directly to confirm the appointment.'
        };
      }

      // Re-check availability under lock to guarantee no double bookings
      const availCheck = await this.checkAvailability(userId, startTime, endTime, calendarId);
      if (availCheck.success && !availCheck.available) {
        logger.warn('CalendarService: Slot was taken immediately before booking (race prevented)', { startTime, endTime, userId });
        return {
          success: false,
          error: 'SLOT_ALREADY_TAKEN',
          instruction: 'That time slot was just booked. Let me propose another time that works for you.'
        };
      }

      const oauth2Client = this.getOauth2Client();
      oauth2Client.setCredentials(tokens);

      const calendar = (getCalendar as any)({ version: 'v3', auth: oauth2Client });
      const targetTz = timezone || 'Asia/Kolkata';

      let fullDescription = description || '';
      if (options?.callerName || options?.callerPhone || options?.callerEmail) {
        fullDescription += `\n\nCaller Information:\n- Name: ${options.callerName || 'Not provided'}\n- Phone: ${options.callerPhone || 'Not provided'}\n- Email: ${options.callerEmail || 'Not provided'}`;
      }
      if (options?.callId) {
        fullDescription += `\n- Claritiy Voice Call Session: ${options.callId}`;
      }

      const attendees = [];
      if (options?.callerEmail) {
        attendees.push({ email: options.callerEmail, displayName: options.callerName || undefined });
      }

      const eventPayload: any = {
        summary: summary || 'Claritiy Voice Appointment',
        description: fullDescription.trim(),
        start: {
          dateTime: startTime,
          timeZone: targetTz,
        },
        end: {
          dateTime: endTime,
          timeZone: targetTz,
        },
        attendees: attendees.length > 0 ? attendees : undefined,
      };

      const event = await this.withTimeoutAndRetry(async () => {
        return await calendar.events.insert({
          calendarId,
          requestBody: eventPayload,
        });
      }, 2500, 1);

      // Invalidate free/busy cache on write
      this.clearCache();

      // If callId provided, write a call event record so AnalysisService / Reports immediately sees the booking
      if (options?.callId) {
        try {
          await prisma.callEvent.create({
            data: {
              callId: options.callId,
              eventType: 'tool_call',
              payload: JSON.stringify({
                toolName: 'schedule_event',
                success: true,
                eventId: event.data.id,
                startTime,
                endTime
              })
            }
          });
        } catch {
          // Non-blocking
        }
      }

      return {
        success: true,
        eventId: event.data.id,
        eventLink: event.data.htmlLink,
        status: 'confirmed'
      };
    } catch (error: any) {
      logger.error('Failed to schedule calendar event', { error: error.message, userId });
      return {
        success: false,
        error: 'CALENDAR_SCHEDULE_FAILED',
        flagFollowUpNeeded: true,
        instruction: 'I have noted your details and our team will reach out to finalize your booking.'
      };
    } finally {
      releaseLock();
    }
  }
}
