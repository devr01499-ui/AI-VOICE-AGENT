import { EventEmitter } from 'events';

export const PROVIDER_EVENTS = {
  CALL_STARTED: 'CALL_STARTED',
  CALL_CONNECTED: 'CALL_CONNECTED',
  CALL_ENDED: 'CALL_ENDED',
  USER_STARTED_SPEAKING: 'USER_STARTED_SPEAKING',
  USER_STOPPED_SPEAKING: 'USER_STOPPED_SPEAKING',
  AI_STARTED_SPEAKING: 'AI_STARTED_SPEAKING',
  AI_STOPPED_SPEAKING: 'AI_STOPPED_SPEAKING',
  TRANSCRIPT_UPDATED: 'TRANSCRIPT_UPDATED',
  PROVIDER_CONNECTED: 'PROVIDER_CONNECTED',
  PROVIDER_DISCONNECTED: 'PROVIDER_DISCONNECTED',
  ERROR_OCCURRED: 'ERROR_OCCURRED',
} as const;

export type ProviderEventType = keyof typeof PROVIDER_EVENTS;

export class ProviderEventBus extends EventEmitter {
  private static _instance: ProviderEventBus | null = null;

  private constructor() {
    super();
    // Allow infinite listeners for orchestrators & dashboards
    this.setMaxListeners(0);
  }

  static get instance(): ProviderEventBus {
    if (!ProviderEventBus._instance) {
      ProviderEventBus._instance = new ProviderEventBus();
    }
    return ProviderEventBus._instance;
  }

  publish(event: ProviderEventType, payload: any): void {
    this.emit(event, payload);
  }

  subscribe(event: ProviderEventType, callback: (payload: any) => void): void {
    this.on(event, callback);
  }

  unsubscribe(event: ProviderEventType, callback: (payload: any) => void): void {
    this.off(event, callback);
  }
}

export const eventBus = ProviderEventBus.instance;
