import { OAuth2Client } from 'google-auth-library';
import { calendar as getCalendar } from 'googleapis/build/src/apis/calendar';
import { prisma } from '../../lib/prisma';
import { logger } from '../../utils/logger';

export const CALENDAR_UNAVAILABLE_SAFE_INSTRUCTION =
  'Calendar integration is unavailable or not connected. Do NOT tell the caller that the calendar is not connected, unavailable, or failed. Do NOT mention systems, calendars, databases, or technical errors. Instead, naturally propose a specific time or acknowledge their preferred time with "noted", and inform them the team will follow up to confirm the slot.';

export class CalendarService {
  private static getOauth2Client() {
    return new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5174/api/v2/calendar/callback'
    );
  }

  static async hasConnectedCalendar(userId?: string | null): Promise<boolean> {
    try {
      if (!userId) return false;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { googleCalendarTokens: true }
      });
      return !!user?.googleCalendarTokens;
    } catch {
      return false;
    }
  }

  static async checkAvailability(userId: string, startTime: string, endTime: string): Promise<any> {
    try {
      if (!userId) {
        return {
          success: false,
          error: 'CALENDAR_NOT_CONNECTED',
          instruction: CALENDAR_UNAVAILABLE_SAFE_INSTRUCTION,
        };
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user?.googleCalendarTokens) {
        return {
          success: false,
          error: 'CALENDAR_NOT_CONNECTED',
          instruction: CALENDAR_UNAVAILABLE_SAFE_INSTRUCTION,
        };
      }

      const tokens = JSON.parse(user.googleCalendarTokens);
      const oauth2Client = this.getOauth2Client();
      oauth2Client.setCredentials(tokens);

      const calendar = (getCalendar as any)({ version: 'v3', auth: oauth2Client });
      
      const res = await calendar.freebusy.query({
        requestBody: {
          timeMin: startTime,
          timeMax: endTime,
          items: [{ id: 'primary' }],
        }
      });

      const busy = res.data.calendars?.['primary']?.busy || [];
      return { success: true, available: busy.length === 0, busySlots: busy };
    } catch (error: any) {
      logger.error('Failed to check calendar availability', { error: error.message, userId });
      return {
        success: false,
        error: 'CALENDAR_CHECK_FAILED',
        instruction: CALENDAR_UNAVAILABLE_SAFE_INSTRUCTION,
      };
    }
  }

  static async scheduleEvent(userId: string, summary: string, startTime: string, endTime: string, description?: string): Promise<any> {
    try {
      if (!userId) {
        return {
          success: false,
          error: 'CALENDAR_NOT_CONNECTED',
          instruction: CALENDAR_UNAVAILABLE_SAFE_INSTRUCTION,
        };
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user?.googleCalendarTokens) {
        return {
          success: false,
          error: 'CALENDAR_NOT_CONNECTED',
          instruction: CALENDAR_UNAVAILABLE_SAFE_INSTRUCTION,
        };
      }

      const tokens = JSON.parse(user.googleCalendarTokens);
      const oauth2Client = this.getOauth2Client();
      oauth2Client.setCredentials(tokens);

      const calendar = (getCalendar as any)({ version: 'v3', auth: oauth2Client });
      
      const event = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: {
          summary,
          description,
          start: {
            dateTime: startTime,
          },
          end: {
            dateTime: endTime,
          },
        }
      });

      return { success: true, eventId: event.data.id, eventLink: event.data.htmlLink };
    } catch (error: any) {
      logger.error('Failed to schedule calendar event', { error: error.message, userId });
      return {
        success: false,
        error: 'CALENDAR_SCHEDULE_FAILED',
        instruction: CALENDAR_UNAVAILABLE_SAFE_INSTRUCTION,
      };
    }
  }
}
