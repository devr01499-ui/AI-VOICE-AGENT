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
}
