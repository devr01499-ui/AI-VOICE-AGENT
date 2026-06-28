export class CallError extends Error {
  constructor(
    public readonly callId: string,
    message: string,
    public readonly code: string = 'CALL_ERROR',
    public readonly context?: Record<string, any>
  ) {
    super(message);
    this.name = 'CallError';
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      callId: this.callId,
      message: this.message,
      context: this.context,
    };
  }

  getFullContext(): Record<string, any> {
    return {
      code: this.code,
      message: this.message,
      callId: this.callId,
      context: this.context,
      timestamp: new Date().toISOString(),
    };
  }

  isRecoverable(): boolean {
    return ['GEMINI_TIMEOUT', 'NETWORK_ERROR'].includes(this.code);
  }
}
