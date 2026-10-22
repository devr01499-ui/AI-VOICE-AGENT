import { CallStatus } from '../../types';
import { eventBus, PROVIDER_EVENTS } from '../provider-sdk/provider.events';
import { logger } from '../../utils/logger';

export class CallStateMachine {
  private currentStatus: CallStatus = 'queued';

  constructor(private readonly callId: string, initialStatus?: CallStatus) {
    if (initialStatus) {
      this.currentStatus = initialStatus;
    }
  }

  getCurrentStatus(): CallStatus {
    return this.currentStatus;
  }

  transitionTo(nextStatus: CallStatus): boolean {
    const prevStatus = this.currentStatus;
    if (prevStatus === nextStatus) return true;

    // Validate states transitions
    const valid = this.validateTransition(prevStatus, nextStatus);
    if (!valid) {
      logger.warn('CallStateMachine: Invalid state transition rejected', {
        callId: this.callId,
        from: prevStatus,
        to: nextStatus,
      });
      // Fail closed: do NOT mutate current status
      return false;
    }

    this.currentStatus = nextStatus;
    logger.info('CallStateMachine: state transition', {
      callId: this.callId,
      from: prevStatus,
      to: nextStatus,
    });

    // Publish state changes to Event Bus
    if (nextStatus === 'connected') {
      eventBus.publish(PROVIDER_EVENTS.CALL_CONNECTED, { callId: this.callId });
    } else if (nextStatus === 'completed' || nextStatus === 'failed') {
      eventBus.publish(PROVIDER_EVENTS.CALL_ENDED, { callId: this.callId, status: nextStatus });
    }

    return true;
  }

  private validateTransition(from: CallStatus, to: CallStatus): boolean {
    const transitions: Record<CallStatus, CallStatus[]> = {
      queued: ['ringing', 'connected', 'in_progress', 'failed', 'timeout', 'cancelled'],
      ringing: ['connected', 'in_progress', 'completed', 'failed', 'no_answer', 'busy', 'timeout', 'cancelled'],
      connected: ['in_progress', 'completed', 'failed', 'timeout', 'cancelled'],
      in_progress: ['completed', 'failed', 'timeout', 'cancelled'],
      completed: [],
      failed: [],
      no_answer: [],
      busy: [],
      cancelled: [],
      timeout: [],
    };
    return transitions[from]?.includes(to) || false;
  }
}
