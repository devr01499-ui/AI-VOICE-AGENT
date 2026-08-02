import Srf from 'drachtio-srf';
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
 * Implements ITelephonyProvider to place outbound calls using drachtio-srf.
 */
export class SipProvider implements ITelephonyProvider {
  public readonly name = 'generic-sip';
  public readonly type = 'telephony';

  private srf: Srf;
  private isConnected = false;
  // Map of requestUuid -> drachtio dialog for active sessions
  private activeDialogs = new Map<string, any>();

  constructor() {
    this.srf = new Srf();
  }

  async connect(): Promise<void> {
    if (process.env.SIP_TRUNKING_ENABLED !== 'true') {
      logger.info('SipProvider: SIP_TRUNKING_ENABLED is not true; skipping drachtio-srf connection');
      this.isConnected = false;
      return Promise.resolve();
    }

    logger.info('SipProvider: starting SIP engine (drachtio-srf)...');
    
    return new Promise((resolve, reject) => {
      // Connect to the local drachtio server
      const host = process.env.DRACHTIO_HOST || '127.0.0.1';
      const port = parseInt(process.env.DRACHTIO_PORT || '9022', 10);
      const secret = process.env.DRACHTIO_SECRET || 'cymru';

      this.srf.connect({
        host,
        port,
        secret
      });

      this.srf.on('connect', (err: any, hostport: string) => {
        if (err) {
          logger.error('SipProvider: failed to connect to drachtio-server', { error: err });
          return reject(err);
        }
        logger.info(`SipProvider: successfully connected to drachtio-server at ${hostport}`);
        this.isConnected = true;
        resolve();
      });

      this.srf.on('error', (err: any) => {
        logger.error('SipProvider: drachtio-server error', { error: err });
      });
    });
  }

  async disconnect(): Promise<void> {
    logger.info('SipProvider: stopping SIP engine...');
    for (const dialog of this.activeDialogs.values()) {
      try {
        await dialog.destroy();
      } catch (err) {
        logger.error('SipProvider: failed to destroy dialog during disconnect', { error: err });
      }
    }
    this.activeDialogs.clear();

    if (this.isConnected) {
      this.srf.disconnect();
      this.isConnected = false;
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    return {
      healthy: this.isConnected,
      latencyMs: 1, // Assumes low latency over local network to drachtio server
      details: this.isConnected ? 'drachtio-srf connected' : 'drachtio-srf disconnected',
    };
  }

  async initiateCall(params: InitiateCallParams): Promise<InitiateCallResult> {
    logger.info('SipProvider: initiating call', { to: params.to, from: params.from });

    if (!this.isConnected) {
      throw new ProviderError('generic-sip', 'SIP engine is not connected to drachtio server.');
    }

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
    
    const requestUuid = uuidv4();
    const sipCallUuid = uuidv4();
    const targetURI = `sip:${params.to}@${sipUriDomain}`;

    // A minimal dummy SDP to establish the call with proper IP substitution
    const localSdp = `v=0\r\no=- 1234567890 1 IN IP4 ${publicIp}\r\ns=-\r\nc=IN IP4 ${publicIp}\r\nt=0 0\r\nm=audio 10000 RTP/AVP 0 8 101\r\na=rtpmap:0 PCMU/8000\r\na=rtpmap:8 PCMA/8000\r\na=rtpmap:101 telephone-event/8000\r\na=sendrecv\r\n`;

    try {
      // drachtio-srf handles the 401/407 challenges automatically when auth is provided.
      this.srf.createUAC(targetURI, {
        localSdp,
        headers: {
          'From': `sip:${params.from}@${sipUriDomain}`,
          'Call-ID': sipCallUuid,
        },
        auth: {
          username: username,
          password: password
        }
      })
      .then(async (dialog: any) => {
        logger.info(`SipProvider: call ${requestUuid} established`);
        this.activeDialogs.set(requestUuid, dialog);

        // Update DB
        try {
          const callRows = await prisma.call.findMany({
            where: { telemetryId: requestUuid }
          });
          if (callRows.length > 0) {
            await prisma.call.update({
              where: { id: callRows[0].id },
              data: { status: 'in_progress' }
            });
          }
        } catch (err) {
          logger.error(`SipProvider: failed to update call state in DB for request ${requestUuid}`, { error: err });
        }

        // Listen for remote hangup
        dialog.on('destroy', async () => {
          logger.info(`SipProvider: call ${requestUuid} terminated by remote party`);
          this.activeDialogs.delete(requestUuid);

          try {
            const callRows = await prisma.call.findMany({
              where: { telemetryId: requestUuid }
            });
            if (callRows.length > 0) {
              await prisma.call.update({
                where: { id: callRows[0].id },
                data: { status: 'completed' }
              });
            }
          } catch (err) {
            logger.error(`SipProvider: failed to persist termination state in DB for ${requestUuid}`, { error: err });
          }
        });
      })
      .catch(async (err: any) => {
        logger.error(`SipProvider: Failed to establish call ${requestUuid}`, { error: err });
        // Call failed (e.g. 403 Forbidden, 486 Busy, timeout, etc.)
        try {
          const callRows = await prisma.call.findMany({
            where: { telemetryId: requestUuid }
          });
          if (callRows.length > 0) {
            await prisma.call.update({
              where: { id: callRows[0].id },
              data: { status: 'failed' }
            });
          }
        } catch (dbErr) {
          logger.error(`SipProvider: failed to update call state to failed in DB for ${requestUuid}`, { error: dbErr });
        }
      });
      
      // Assume ringing before the dialog is established
      setTimeout(async () => {
         try {
           const callRows = await prisma.call.findMany({
             where: { telemetryId: requestUuid }
           });
           if (callRows.length > 0 && callRows[0].status === 'queued') {
             await prisma.call.update({
               where: { id: callRows[0].id },
               data: { status: 'ringing' }
             });
           }
         } catch (err) {
           logger.error(`SipProvider: failed to update ringing state`, { error: err });
         }
      }, 500);

    } catch (err) {
      throw new ProviderError('generic-sip', `Failed to send SIP INVITE: ${err}`);
    }

    return {
      callUuid: sipCallUuid,
      requestUuid: requestUuid,
    };
  }

  async terminateCall(callUuid: string): Promise<void> {
    logger.info('SipProvider: terminating call', { callUuid });
    
    // Check active dialogs for this requestUuid
    let dialog = this.activeDialogs.get(callUuid);

    if (dialog) {
      try {
        await dialog.destroy(); // Sends actual SIP BYE
      } catch (err) {
        logger.error(`SipProvider: failed to terminate SIP dialog ${callUuid}`, { error: err });
      }
      this.activeDialogs.delete(callUuid);
    } else {
      logger.warn(`SipProvider: active dialog not found locally for ${callUuid}. Call might already be disconnected or still establishing.`);
    }

    try {
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
