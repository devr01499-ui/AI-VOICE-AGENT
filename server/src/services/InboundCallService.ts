import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

export interface InboundCallResult {
  success: boolean;
  callId?: string;
  agentId?: string;
  userId?: string;
  errorMessage?: string;
  statusCode?: number;
}

export class InboundCallService {
  /**
   * Processes an incoming webhook from Vobiz when an inbound call arrives.
   * Looks up the dialed number ('To'), verifies user minute balance,
   * creates an inbound Call record, and identifies the assigned agent.
   */
  static async handleInboundCall(payload: {
    CallUUID?: string;
    RequestUUID?: string;
    From?: string;
    To?: string;
    CallStatus?: string;
  }): Promise<InboundCallResult> {
    try {
      const rawTo = payload.To || '';
      const rawFrom = payload.From || 'Anonymous';
      const callUuid = payload.CallUUID || payload.RequestUUID || `inbound_${Date.now()}`;

      if (!rawTo) {
        logger.error('InboundCallService: Missing "To" phone number in webhook payload', { payload });
        return { success: false, errorMessage: 'Missing target phone number', statusCode: 400 };
      }

      // Normalize phone number formats for query (try exact, +E.164, and digits)
      const cleanToDigits = rawTo.replace(/\D/g, '');
      const toVariants = Array.from(new Set([
        rawTo,
        `+${cleanToDigits}`,
        cleanToDigits,
      ]));

      // 1. Find phone number record in database
      const numberRecord = await prisma.phoneNumber.findFirst({
        where: {
          phoneNumber: { in: toVariants }
        },
        include: {
          user: true,
          agent: true,
          inboundConfigs: {
            include: { agent: true }
          }
        }
      });

      if (!numberRecord) {
        logger.warn('InboundCallService: Phone number not found in database', { rawTo, toVariants });
        return { success: false, errorMessage: 'Phone number not registered to any user', statusCode: 404 };
      }

      const user = numberRecord.user;
      if (!user) {
        logger.error('InboundCallService: User not associated with phone number', { numberId: numberRecord.id });
        return { success: false, errorMessage: 'User record missing', statusCode: 404 };
      }

      // 2. Check Minute Balance Gate (Billing Engine)
      const { ADMIN_EMAIL } = require('../config/constants');
      if (user.email !== ADMIN_EMAIL && user.callingBalanceMinutes <= 0) {
        logger.warn('InboundCallService: Insufficient minute balance for inbound call', {
          userId: user.id,
          balance: user.callingBalanceMinutes
        });
        return {
          success: false,
          errorMessage: 'Insufficient balance to accept inbound call',
          statusCode: 402
        };
      }

      // 3. Determine assigned Agent
      // Priority 1: Agent from InboundConfig
      // Priority 2: assignedAgentId on PhoneNumber
      // Priority 3: First active agent owned by user
      let targetAgentId = numberRecord.assignedAgentId;

      if (numberRecord.inboundConfigs && numberRecord.inboundConfigs.length > 0) {
        const activeInboundConfig = numberRecord.inboundConfigs[0];
        if (activeInboundConfig.agentId) {
          targetAgentId = activeInboundConfig.agentId;
        }
      }

      if (!targetAgentId) {
        const fallbackAgent = await prisma.agent.findFirst({
          where: { userId: user.id, status: 'active' }
        });
        if (fallbackAgent) {
          targetAgentId = fallbackAgent.id;
        }
      }

      if (!targetAgentId) {
        logger.warn('InboundCallService: No active agent assigned to answer call', {
          userId: user.id,
          numberId: numberRecord.id
        });
        return { success: false, errorMessage: 'No AI agent configured to answer this number', statusCode: 422 };
      }

      // 4. Create Call Record in Database (direction = 'inbound')
      const callRecord = await prisma.call.create({
        data: {
          telemetryId: callUuid,
          userId: user.id,
          agentId: targetAgentId,
          fromPhoneNumber: rawTo,
          recipientPhoneNumber: rawFrom,
          callDirection: 'inbound',
          status: 'ringing',
          userData: JSON.stringify({
            direction: 'inbound',
            dialedNumber: rawTo,
            callerNumber: rawFrom,
            vobizCallUuid: callUuid,
            startTime: new Date().toISOString()
          })
        }
      });

      logger.info('InboundCallService: Inbound call initialized', {
        callId: callRecord.id,
        userId: user.id,
        agentId: targetAgentId,
        from: rawFrom,
        to: rawTo
      });

      return {
        success: true,
        callId: callRecord.id,
        agentId: targetAgentId,
        userId: user.id
      };
    } catch (err: any) {
      logger.error('InboundCallService: Failed to handle inbound call', { error: String(err) });
      return { success: false, errorMessage: err.message || 'Internal server error', statusCode: 500 };
    }
  }

  /**
   * Helper to set or update calling config (inbound & outbound) for a phone number.
   */
  static async updateCallingConfig(params: {
    userId: string;
    phoneNumberId: string;
    assignedAgentId?: string;
    inboundAgentId?: string;
    inboundEnabled?: boolean;
    businessHours?: string;
  }) {
    const { userId, phoneNumberId, assignedAgentId, inboundAgentId, inboundEnabled, businessHours } = params;

    // Verify ownership
    const phoneRecord = await prisma.phoneNumber.findFirst({
      where: { id: phoneNumberId, userId }
    });

    if (!phoneRecord) {
      throw new Error('Phone number not found or unauthorized');
    }

    // Update PhoneNumber
    const updatedNumber = await prisma.phoneNumber.update({
      where: { id: phoneNumberId },
      data: {
        ...(assignedAgentId !== undefined && { assignedAgentId }),
        ...(inboundEnabled !== undefined && { status: inboundEnabled ? 'active' : 'inactive' })
      }
    });

    // Update or create InboundConfig
    if (inboundAgentId) {
      const existingConfig = await prisma.inboundConfig.findFirst({
        where: { phoneNumberId }
      });

      if (existingConfig) {
        await prisma.inboundConfig.update({
          where: { id: existingConfig.id },
          data: {
            agentId: inboundAgentId,
            ...(businessHours && { businessHours })
          }
        });
      } else {
        await prisma.inboundConfig.create({
          data: {
            phoneNumberId,
            agentId: inboundAgentId,
            ...(businessHours && { businessHours })
          }
        });
      }
    }

    return updatedNumber;
  }
}
