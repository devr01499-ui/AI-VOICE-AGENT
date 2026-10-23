import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { hasCallableBalance } from '../utils/balanceUtils';
import { logAuditEvent } from '../utils/auditLogger';

export interface InboundCallResult {
  success: boolean;
  callId?: string;
  agentId?: string;
  userId?: string;
  errorMessage?: string;
  spokenMessage?: string;
  endReason?: string;
  statusCode?: number;
}

export class InboundCallService {
  /**
   * Processes an incoming webhook from Plivo / Vobiz when an inbound call arrives.
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
        return {
          success: false,
          errorMessage: 'Missing target phone number',
          spokenMessage: 'This number is currently unavailable. Please try again later.',
          endReason: 'provider_error',
          statusCode: 400
        };
      }

      // 0. Idempotency / Deduplication check against duplicate answer webhooks
      if (callUuid) {
        const existingCall = await prisma.call.findFirst({
          where: { telemetryId: callUuid }
        });
        if (existingCall) {
          logger.info('InboundCallService: Duplicate inbound answer webhook received, returning existing call idempotently', {
            callId: existingCall.id,
            callUuid,
          });
          return {
            success: true,
            callId: existingCall.id,
            agentId: existingCall.agentId,
            userId: existingCall.userId,
          };
        }
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
        return {
          success: false,
          errorMessage: 'Phone number not registered to any user',
          spokenMessage: 'This number is currently unavailable. Please try again later.',
          endReason: 'provider_error',
          statusCode: 404
        };
      }

      const user = numberRecord.user;
      if (!user) {
        logger.error('InboundCallService: User not associated with phone number', { numberId: numberRecord.id });
        return {
          success: false,
          errorMessage: 'User record missing',
          spokenMessage: 'This number is currently unavailable. Please try again later.',
          endReason: 'provider_error',
          statusCode: 404
        };
      }

      const recordBlockedCall = async (reasonCode: string, internalError: string): Promise<string | undefined> => {
        logAuditEvent({
          workspaceOwnerId: user.id,
          actorUserId: user.id,
          action: 'INBOUND_CALL_BLOCKED',
          targetId: numberRecord.id,
          metadata: {
            from: rawFrom,
            to: rawTo,
            callUuid,
            reason: reasonCode,
            detail: internalError,
          }
        });

        let targetAgentId = numberRecord.assignedAgentId;
        if (!targetAgentId && numberRecord.inboundConfigs && numberRecord.inboundConfigs.length > 0) {
          targetAgentId = numberRecord.inboundConfigs[0].agentId || null;
        }
        if (!targetAgentId) {
          const fallbackAgent = await prisma.agent.findFirst({
            where: { userId: user.id }
          });
          targetAgentId = fallbackAgent?.id || null;
        }
        if (!targetAgentId) {
          const anyAgent = await prisma.agent.findFirst();
          targetAgentId = anyAgent?.id || null;
        }

        if (!targetAgentId) {
          logger.warn('InboundCallService: Cannot record blocked call row because no agent exists in database', { callUuid });
          return undefined;
        }

        const blockedCall = await prisma.call.create({
          data: {
            telemetryId: callUuid,
            userId: user.id,
            agentId: targetAgentId,
            fromPhoneNumber: rawTo,
            recipientPhoneNumber: rawFrom,
            callDirection: 'inbound',
            status: 'failed',
            endReason: reasonCode as any,
            endedBy: 'system',
            endDetail: internalError,
            endTime: new Date(),
            durationSeconds: 0,
            userData: JSON.stringify({
              direction: 'inbound',
              dialedNumber: rawTo,
              callerNumber: rawFrom,
              blockedReason: internalError,
            })
          }
        }).catch((err) => {
          logger.warn('InboundCallService: Failed to record blocked call row', { err });
          return null;
        });

        return blockedCall?.id;
      };

      // 1b. Check Local Number Activation Gate
      if (numberRecord.status !== 'active') {
        logger.warn('InboundCallService: Inbound call blocked - number awaiting activation', { rawTo, status: numberRecord.status });
        const internalErr = 'Phone number is awaiting activation. It will become active once KYC is verified.';
        const callId = await recordBlockedCall('provider_error', internalErr);
        return {
          success: false,
          callId: callId || undefined,
          errorMessage: internalErr,
          spokenMessage: 'This number is currently unavailable. Please try again later.',
          endReason: 'provider_error',
          statusCode: 403
        };
      }

      if (numberRecord.kycStatus !== 'verified') {
        logger.warn('InboundCallService: Inbound call blocked due to unverified KYC', { rawTo, kycStatus: numberRecord.kycStatus });
        const internalErr = 'Inbound calls blocked. KYC verification is pending or incomplete for this phone number.';
        const callId = await recordBlockedCall('provider_error', internalErr);
        return {
          success: false,
          callId: callId || undefined,
          errorMessage: internalErr,
          spokenMessage: 'This number is currently unavailable. Please try again later.',
          endReason: 'provider_error',
          statusCode: 403
        };
      }

      // Provider-specific gating
      if (numberRecord.telephonyProvider === 'vobiz' || !numberRecord.telephonyProvider) {
        const subAccount = await prisma.vobizSubAccount.findUnique({
          where: { userId: user.id }
        });
        if (subAccount && (subAccount.kycStatus !== 'verified' || subAccount.kycCallsBlocked)) {
          logger.warn('InboundCallService: Inbound call blocked - Vobiz sub-account KYC unverified or calls blocked', {
            userId: user.id,
            kycStatus: subAccount.kycStatus,
            kycCallsBlocked: subAccount.kycCallsBlocked
          });
          const internalErr = 'Inbound calls blocked. KYC verification is required for this account before receiving calls.';
          const callId = await recordBlockedCall('provider_error', internalErr);
          return {
            success: false,
            callId: callId || undefined,
            errorMessage: internalErr,
            spokenMessage: 'This number is currently unavailable. Please try again later.',
            endReason: 'provider_error',
            statusCode: 403
          };
        }
      } else if (numberRecord.telephonyProvider === 'plivo') {
        const plivoSub = await prisma.plivoSubAccount.findUnique({
          where: { userId: user.id }
        });
        if (plivoSub && !plivoSub.enabled) {
          logger.warn('InboundCallService: Inbound call blocked - Plivo sub-account disabled', {
            userId: user.id,
          });
          const internalErr = 'Inbound calls blocked. Carrier account is disabled.';
          const callId = await recordBlockedCall('provider_error', internalErr);
          return {
            success: false,
            callId: callId || undefined,
            errorMessage: internalErr,
            spokenMessage: 'This number is currently unavailable. Please try again later.',
            endReason: 'provider_error',
            statusCode: 403
          };
        }
      }

      // Account Suspension Gate
      if (user.accountStatus === 'suspended') {
        logger.warn('InboundCallService: Inbound call blocked due to account suspension', {
          userId: user.id,
          reason: user.suspendedReason,
        });
        const internalErr = 'This service is temporarily unavailable. Please contact support.';
        const callId = await recordBlockedCall('provider_error', internalErr);
        return {
          success: false,
          callId: callId || undefined,
          errorMessage: internalErr,
          spokenMessage: 'This number is currently unavailable. Please try again later.',
          endReason: 'provider_error',
          statusCode: 403,
        };
      }

      // 2. Check Minute Balance Gate (Billing Engine) via unified helper
      if (user.accountType !== 'admin' && !hasCallableBalance(user)) {
        logger.warn('InboundCallService: Insufficient minute balance for inbound call', {
          userId: user.id,
          minutesRemainingSeconds: user.minutesRemainingSeconds,
          callingBalanceMinutes: user.callingBalanceMinutes,
        });
        const internalErr = 'Insufficient balance to accept inbound call';
        const callId = await recordBlockedCall('balance_exhausted', internalErr);
        return {
          success: false,
          callId: callId || undefined,
          errorMessage: internalErr,
          spokenMessage: 'This number is currently unavailable. Please try again later.',
          endReason: 'balance_exhausted',
          statusCode: 402
        };
      }

      // 3. Determine assigned Agent
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
        const internalErr = 'No AI agent configured to answer this number';
        const callId = await recordBlockedCall('provider_error', internalErr);
        return {
          success: false,
          callId: callId || undefined,
          errorMessage: internalErr,
          spokenMessage: 'Thank you for calling. No representative is currently available to take your call. Please try again later.',
          endReason: 'provider_error',
          statusCode: 422
        };
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
      return {
        success: false,
        errorMessage: err.message || 'Internal server error',
        spokenMessage: 'This number is currently unavailable. Please try again later.',
        endReason: 'provider_error',
        statusCode: 500
      };
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

    // Verify ownership of the phone number
    const phoneRecord = await prisma.phoneNumber.findFirst({
      where: { id: phoneNumberId, userId }
    });

    if (!phoneRecord) {
      throw new Error('Phone number not found or unauthorized');
    }

    // IDOR Protection: Verify assigned agent belongs to user
    if (assignedAgentId) {
      const assignedAgent = await prisma.agent.findFirst({
        where: { id: assignedAgentId, userId }
      });
      if (!assignedAgent) {
        throw new Error('Assigned outbound agent not found or unauthorized');
      }
    }

    // IDOR Protection: Verify inbound agent belongs to user
    if (inboundAgentId) {
      const inboundAgent = await prisma.agent.findFirst({
        where: { id: inboundAgentId, userId }
      });
      if (!inboundAgent) {
        throw new Error('Inbound agent not found or unauthorized');
      }
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
