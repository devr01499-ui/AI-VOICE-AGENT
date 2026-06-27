import { CallStatus } from '../../types';
import { eventBus, PROVIDER_EVENTS } from '../provider-sdk/provider.events';
import { logger } from '../../utils/logger';

export class CallStateMachine {
  private currentStatus: CallStatus = 'queued';

  constructor(private readonly callId: string) {}

  getCurrentStatus(): CallStatus {
    return this.currentStatus;
  }

  transitionTo(nextStatus: CallStatus): void {
    const prevStatus = this.currentStatus;
    if (prevStatus === nextStatus) return;

    // Validate states transitions
    const valid = this.validateTransition(prevStatus, nextStatus);
    if (!valid) {
      logger.warn('CallStateMachine: Invalid state transition attempted', {
        callId: this.callId,
        from: prevStatus,
        to: nextStatus,
      });
      // Permissive in dev to avoid hard failures
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
  }

  private validateTransition(from: CallStatus, to: CallStatus): boolean {
    const transitions: Record<CallStatus, CallStatus[]> = {
      queued: ['ringing', 'connected', 'failed'],
      ringing: ['connected', 'completed', 'failed'],
      connected: ['in_progress', 'completed', 'failed'],
      in_progress: ['completed', 'failed'],
      completed: [],
      failed: [],
      no_answer: [],
      busy: [],
      cancelled: [],
    };
    return transitions[from]?.includes(to) || false;
  }
}
