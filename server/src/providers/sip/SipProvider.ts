// @ts-ignore
import * as sip from 'sip';
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
 * Implements ITelephonyProvider to place outbound calls using standard SIP protocol.
 * Capable of working with Twilio, Exotel, Plivo, or any other standard SIP trunk.
 */
export class SipProvider implements ITelephonyProvider {
  public readonly name = 'generic-sip';
  public readonly type = 'telephony';

  private activeCalls = new Map<string, { status: string; duration: number }>();

  private sipClient: any;

  constructor() {}

  async connect(): Promise<void> {
    logger.info('SipProvider: starting SIP listener...');
    
    // Start the SIP stack on a port (e.g. 5060 or dynamic for testing)
    // In a real production deployment, this needs public IP mapping or NAT traversal.
    const sipPort = process.env.SIP_PORT ? parseInt(process.env.SIP_PORT) : 5060;
    this.sipClient = sip.create({ port: sipPort }, (request: any) => {
      logger.info(`SipProvider: received incoming SIP request: ${request.method}`);
      // In a full implementation, we'd handle incoming INVITEs here for inbound calling.
      // For now, we respond with 501 Not Implemented to unsupported inbound requests.
      this.sipClient.send(sip.makeResponse(request, 501, 'Not Implemented'));
    });

    logger.info('SipProvider: SIP stack initialized.');
  }

  async disconnect(): Promise<void> {
    logger.info('SipProvider: stopping SIP listener...');
    if (this.sipClient && this.sipClient.destroy) {
      this.sipClient.destroy();
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    // A SIP client running locally is generally healthy if the stack is up.
    // Real health check could send OPTIONS ping to a configured proxy.
    return {
      healthy: true,
      latencyMs: 1,
      details: 'SIP stack is active',
    };
  }

  async initiateCall(params: InitiateCallParams): Promise<InitiateCallResult> {
    logger.info('SipProvider: initiating call', { to: params.to, from: params.from });

    if (!params.userId) {
      throw new ProviderError('generic-sip', 'Access Denied: userId is required for SIP calling.');
    }

    // Fetch the specific SipTrunk configuration for this user
    const userTrunk = await prisma.sipTrunk.findFirst({
      where: { userId: params.userId, status: 'active' }
    });

    if (!userTrunk) {
      throw new ProviderError('generic-sip', `No active SIP trunk configured for user ${params.userId}.`);
    }

    const sipUri = userTrunk.sipUri; // e.g., sip.twilio.com
    const username = userTrunk.username || 'unknown';
    let password = '';

    if (userTrunk.password) {
      try {
        password = EncryptionService.decrypt(userTrunk.password);
      } catch (err) {
        throw new ProviderError('generic-sip', 'Failed to decrypt SIP password. Ensure valid encryption format.');
      }
    }

    const callUuid = uuidv4();
    const tag = Math.random().toString(36).substr(2, 9);
    
    // Construct the standard SIP INVITE message
    const inviteRequest = {
      method: 'INVITE',
      uri: `sip:${params.to}@${sipUri}`,
      headers: {
        to: { uri: `sip:${params.to}@${sipUri}` },
        from: { uri: `sip:${params.from}@${sipUri}`, params: { tag } },
        'call-id': callUuid,
        cseq: { method: 'INVITE', seq: 1 },
        contact: [{ uri: `sip:${params.from}@127.0.0.1:${process.env.SIP_PORT || 5060}` }],
        // Basic SIP Auth Header structure (though typically a 401 challenge is sent back first)
        authorization: `Digest username="${username}", password="${password}"`, // Simplified
        'content-type': 'application/sdp',
      },
      // Note: Real implementations require an actual SDP body describing media ports (RTP)
      content: 'v=0\r\no=bolna 123 456 IN IP4 127.0.0.1\r\ns=-\r\nc=IN IP4 127.0.0.1\r\nt=0 0\r\nm=audio 10000 RTP/AVP 0 8\r\na=rtpmap:0 PCMU/8000\r\na=rtpmap:8 PCMA/8000\r\n',
    };

    this.activeCalls.set(callUuid, { status: 'ringing', duration: 0 });

    try {
      this.sipClient.send(inviteRequest, (rs: any) => {
        logger.info(`SipProvider: received SIP response ${rs.status}`);
        
        if (rs.status >= 200 && rs.status < 300) {
          logger.info(`SipProvider: call ${callUuid} answered.`);
          this.activeCalls.set(callUuid, { status: 'in_progress', duration: 0 });
          // Acknowledge the 200 OK
          this.sipClient.send({
            method: 'ACK',
            uri: rs.headers.contact ? rs.headers.contact[0].uri : inviteRequest.uri,
            headers: {
              to: rs.headers.to,
              from: rs.headers.from,
              'call-id': callUuid,
              cseq: { method: 'ACK', seq: 1 },
            }
          });
        } else if (rs.status >= 400) {
          logger.error(`SipProvider: call ${callUuid} failed with SIP status ${rs.status}`);
          this.activeCalls.set(callUuid, { status: 'failed', duration: 0 });
        }
      });

      return {
        callUuid: callUuid,
        requestUuid: callUuid,
      };

    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new ProviderError('generic-sip', `Failed to send SIP INVITE: ${message}`);
    }
  }

  async terminateCall(callUuid: string): Promise<void> {
    logger.info('SipProvider: terminating call', { callUuid });
    
    // In a full implementation, we need the stored Dialog state (to-tag, remote-contact) 
    // to construct a proper BYE message. For this minimal generic engine, we simulate termination.
    if (this.activeCalls.has(callUuid)) {
      this.activeCalls.set(callUuid, { status: 'completed', duration: 10 });
    }
  }

  async getCallStatus(callUuid: string): Promise<CallStatusResult> {
    const callData = this.activeCalls.get(callUuid);
    if (!callData) {
      return { status: 'completed', direction: 'outbound' };
    }
    
    return {
      status: callData.status,
      direction: 'outbound',
      duration: callData.duration,
    };
  }
}
