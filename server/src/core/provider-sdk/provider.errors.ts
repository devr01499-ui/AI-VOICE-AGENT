export class ProviderSDKError extends Error {
  constructor(
    public readonly providerName: string,
    message: string,
    public readonly code?: string
  ) {
    super(`[ProviderSDK:${providerName}] ${message}`);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class SessionNotFoundError extends ProviderSDKError {
  constructor(providerName: string, sessionId: string) {
    super(providerName, `Session not found: ${sessionId}`, 'SESSION_NOT_FOUND');
  }
}

export class ProviderConfigurationError extends ProviderSDKError {
  constructor(providerName: string, message: string) {
    super(providerName, `Configuration error: ${message}`, 'CONFIG_ERROR');
  }
}

export class ProviderConnectionError extends ProviderSDKError {
  constructor(providerName: string, message: string) {
    super(providerName, `Connection failed: ${message}`, 'CONNECTION_FAILED');
  }
}
