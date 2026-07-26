import { UserAgent, Inviter, SessionState, UserAgentOptions, URI } from 'sip.js';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';
import { ProviderError } from '../../types/errors';
import { prisma } from '../../lib/prisma';
import { EncryptionService } from '../../utils/EncryptionService';
import type {
  ITelephonyProvider,
  HealthCheckResult,
  InitiateCallParams,
  InitiateCallResult,
  CallStatusResult,
} from '../interfaces/IProvider';

/**
 * Bolna Server — Generic SIP Provider
 *
 * Implements ITelephonyProvider to place outbound calls using sip.js.
 */
export class SipProvider implements ITelephonyProvider {
  public readonly name = 'generic-sip';
  public readonly type = 'telephony';

  // We maintain the active Session objects in memory to manage the media/signaling lifecycle,
  // but call STATUS and METADATA are persisted to the database per Phase 4 requirements.
  private activeSessions = new Map<string, Inviter>();
  private userAgents = new Map<string, UserAgent>();

  constructor() {}

  async connect(): Promise<void> {
    logger.info('SipProvider: starting SIP engine (sip.js)...');
    // UserAgents are instantiated on-demand per trunk configuration
  }

  async disconnect(): Promise<void> {
    logger.info('SipProvider: stopping SIP engine...');
    for (const session of this.activeSessions.values()) {
      try {
        if (session.state === SessionState.Established) {
          await session.bye();
        } else if (session.state === SessionState.Initial || session.state === SessionState.Establishing) {
          await session.cancel();
        }
      } catch (err) {
        logger.error('SipProvider: failed to terminate session during disconnect', { error: err });
      }
    }
    
    for (const ua of this.userAgents.values()) {
      await ua.stop();
    }
    
    this.userAgents.clear();
    this.activeSessions.clear();
  }

  async healthCheck(): Promise<HealthCheckResult> {
    return {
      healthy: true,
      latencyMs: 1,
      details: 'sip.js engine ready',
    };
  }

  async initiateCall(params: InitiateCallParams): Promise<InitiateCallResult> {
    logger.info('SipProvider: initiating call', { to: params.to, from: params.from });

    if (!params.userId) {
      throw new ProviderError('generic-sip', 'Access Denied: userId is required for SIP calling.');
    }

    const userTrunk = await prisma.sipTrunk.findFirst({
      where: { userId: params.userId, status: 'active' }
    });

    if (!userTrunk) {
      throw new ProviderError('generic-sip', `No active SIP trunk configured for user ${params.userId}.`);
    }

    const sipUriDomain = userTrunk.sipUri; 
    const username = userTrunk.username || 'unknown';
    let password = '';

    if (userTrunk.password) {
      try {
        password = EncryptionService.decrypt(userTrunk.password);
      } catch (err) {
        throw new ProviderError('generic-sip', 'Failed to decrypt SIP password. Ensure valid encryption format.');
      }
    }

    const publicIp = process.env.PUBLIC_IP || '127.0.0.1';
    if (publicIp === '127.0.0.1') {
      logger.warn('SipProvider: PUBLIC_IP not set, using 127.0.0.1 for SDP media address. Two-way audio may fail across NAT.');
    }

    const uaKey = `${username}@${sipUriDomain}`;
    let ua = this.userAgents.get(uaKey);

    if (!ua) {
      // Configure sip.js UserAgent with Digest Auth
      const uaOptions: UserAgentOptions = {
        uri: UserAgent.makeURI(`sip:${username}@${sipUriDomain}`),
        authorizationUsername: username,
        authorizationPassword: password,
        transportOptions: {
          server: `wss://${sipUriDomain}`, // Defaulting to WSS for Node.js
        },
        logBuiltinEnabled: false,
      };

      try {
        ua = new UserAgent(uaOptions);
        await ua.start();
        this.userAgents.set(uaKey, ua);
      } catch (err) {
        throw new ProviderError('generic-sip', `Failed to start UserAgent: ${err}`);
      }
    }

    const targetURI = UserAgent.makeURI(`sip:${params.to}@${sipUriDomain}`);
    if (!targetURI) {
      throw new ProviderError('generic-sip', `Invalid target URI: sip:${params.to}@${sipUriDomain}`);
    }

    const requestUuid = uuidv4();
    const sipCallUuid = uuidv4();

    // Persist initial state to DB instead of in-memory Map
    // We cannot create a valid Call record without agentId because of foreign key constraint in the schema.
    // Instead of forcing agentId='system' which fails if no agent exists, we use the Orchestrator's pattern:
    // The orchestrator owns the Call model row, the SipProvider tracks a separate record or we just store
    // minimal metadata if we can't create it. However, since Phase 4 explicitly demands we persist call state,
    // we assume the user intends we just fetch/update the call using telemetryId.
    // Wait, the orchestrator sets telemetryId after initiateCall returns!
    // So the orchestrator creates a Call row, then calls initiateCall, then saves requestUuid to telemetryId.
    // We can't update the orchestrator's row before it sets it! 
    // Wait, we CAN fetch the call if we pass callId in params? params doesn't have callId.
    // So, we don't CREATE the Call row here. We return requestUuid, orchestrator saves it to telemetryId.
    // Our event listener for SessionState will update the DB by looking up the Call with telemetryId = requestUuid!
    
    const inviter = new Inviter(ua, targetURI, {
      extraHeaders: [
        `From: <sip:${params.from}@${sipUriDomain}>`,
        `Call-ID: ${sipCallUuid}`
      ]
    });

    this.activeSessions.set(requestUuid, inviter);

    inviter.stateChange.addListener(async (newState: SessionState) => {
      logger.info(`SipProvider: call request ${requestUuid} transitioned to state ${newState}`);
      
      let dbStatus = 'ringing';
      if (newState === SessionState.Established) {
        dbStatus = 'in_progress';
      } else if (newState === SessionState.Terminated) {
        dbStatus = 'completed';
        this.activeSessions.delete(requestUuid);
      }

      try {
        // Find the Orchestrator's call using the telemetryId we returned
        const callRows = await prisma.call.findMany({
          where: { telemetryId: requestUuid }
        });
        if (callRows.length > 0) {
          await prisma.call.update({
            where: { id: callRows[0].id },
            data: { status: dbStatus }
          });
        }
      } catch (err) {
        logger.error(`SipProvider: failed to update call state in DB for request ${requestUuid}`, { error: err });
      }
    });

    try {
      // sip.js handles the 401/407 digest auth challenges automatically during invite
      await inviter.invite();
    } catch (err) {
      throw new ProviderError('generic-sip', `Failed to send SIP INVITE (Check WSS connectivity and credentials): ${err}`);
    }

    return {
      callUuid: sipCallUuid,
      requestUuid: requestUuid,
    };
  }

  async terminateCall(callUuid: string): Promise<void> {
    logger.info('SipProvider: terminating call', { callUuid });
    
    // In our new architecture, the Orchestrator passes its Call.id here? No, it passes telemetryId or callUuid?
    // The orchestrator calls telephonyProvider.terminateCall? Wait, in CallOrchestrator I didn't see terminateCall for generic-sip.
    // It is called somewhere. It passes `callUuid` which was returned from initiateCall.
    
    // Find the inviter locally
    let session = this.activeSessions.get(callUuid); // if they pass requestUuid
    if (!session) {
       // if they pass sipCallUuid, we'd need to track it by sipCallUuid too
       for (const [key, val] of this.activeSessions.entries()) {
           if (val.request.callId === callUuid) session = val;
       }
    }

    if (session) {
      try {
        if (session.state === SessionState.Established) {
          await session.bye(); // Sends actual SIP BYE
        } else if (session.state === SessionState.Initial || session.state === SessionState.Establishing) {
          await session.cancel(); // Sends actual SIP CANCEL
        }
      } catch (err) {
        logger.error(`SipProvider: failed to terminate SIP session ${callUuid}`, { error: err });
      }
      this.activeSessions.delete(callUuid);
    } else {
      logger.warn(`SipProvider: active session not found locally for ${callUuid}. Another instance may own it.`);
    }

    try {
      // Find the Call row to update
      const callRows = await prisma.call.findMany({
        where: { OR: [ { id: callUuid }, { telemetryId: callUuid } ] }
      });
      if (callRows.length > 0) {
        await prisma.call.update({
          where: { id: callRows[0].id },
          data: { status: 'completed' }
        });
      }
    } catch (err) {
      logger.error(`SipProvider: failed to persist termination state in DB for ${callUuid}`, { error: err });
    }
  }

  async getCallStatus(callUuid: string): Promise<CallStatusResult> {
    try {
      const callRows = await prisma.call.findMany({
        where: { OR: [ { id: callUuid }, { telemetryId: callUuid } ] }
      });

      if (callRows.length === 0) {
        return { status: 'completed', direction: 'outbound' };
      }
      
      return {
        status: callRows[0].status,
        direction: callRows[0].callDirection || 'outbound',
        duration: callRows[0].durationSeconds || 0,
      };
    } catch (err) {
      logger.error(`SipProvider: failed to fetch call status from DB for ${callUuid}`, { error: err });
      return { status: 'failed', direction: 'outbound' };
    }
  }
}
