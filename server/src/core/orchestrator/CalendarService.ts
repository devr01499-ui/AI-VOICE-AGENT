import { google } from 'googleapis';
import { prisma } from '../../lib/prisma';
import { logger } from '../../utils/logger';

export class CalendarService {
  private static getOauth2Client() {
    return new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5174/api/v2/calendar/callback'
    );
  }

  static async checkAvailability(userId: string, startTime: string, endTime: string): Promise<any> {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user?.googleCalendarTokens) {
        return { success: false, error: 'Google Calendar not connected' };
      }

      const tokens = JSON.parse(user.googleCalendarTokens);
      const oauth2Client = this.getOauth2Client();
      oauth2Client.setCredentials(tokens);

      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      
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
      return { success: false, error: 'Failed to check calendar availability' };
    }
  }

  static async scheduleEvent(userId: string, summary: string, startTime: string, endTime: string, description?: string): Promise<any> {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user?.googleCalendarTokens) {
        return { success: false, error: 'Google Calendar not connected' };
      }

      const tokens = JSON.parse(user.googleCalendarTokens);
      const oauth2Client = this.getOauth2Client();
      oauth2Client.setCredentials(tokens);

      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      
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
      return { success: false, error: 'Failed to schedule event' };
    }
  }
}
