export interface SessionMetrics {
  latencyMs: number;
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
  reconnectCount: number;
  packetLoss: number;
  errorsCount: number;
  sessionDurationMs: number;
  messagesSent: number;
  messagesReceived: number;
  audioChunksSent: number;
  audioChunksReceived: number;
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

export class MetricsCollector {
  private metrics = new Map<string, SessionMetrics>();

  initializeSession(sessionId: string): void {
    this.metrics.set(sessionId, {
      latencyMs: 0,
      connectionStatus: 'connecting',
      reconnectCount: 0,
      packetLoss: 0,
      errorsCount: 0,
      sessionDurationMs: 0,
      messagesSent: 0,
      messagesReceived: 0,
      audioChunksSent: 0,
      audioChunksReceived: 0,
      tokenUsage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      },
    });
  }

  getMetrics(sessionId: string): SessionMetrics | null {
    return this.metrics.get(sessionId) || null;
  }

  updateLatency(sessionId: string, latencyMs: number): void {
    const metric = this.metrics.get(sessionId);
    if (metric) {
      metric.latencyMs = latencyMs;
    }
  }

  incrementReconnect(sessionId: string): void {
    const metric = this.metrics.get(sessionId);
    if (metric) {
      metric.reconnectCount++;
    }
  }

  incrementError(sessionId: string): void {
    const metric = this.metrics.get(sessionId);
    if (metric) {
      metric.errorsCount++;
    }
  }

  recordAudioChunkSent(sessionId: string): void {
    const metric = this.metrics.get(sessionId);
    if (metric) {
      metric.audioChunksSent++;
      metric.messagesSent++;
    }
  }

  recordAudioChunkReceived(sessionId: string): void {
    const metric = this.metrics.get(sessionId);
    if (metric) {
      metric.audioChunksReceived++;
      metric.messagesReceived++;
    }
  }

  updateTokens(sessionId: string, input: number, output: number): void {
    const metric = this.metrics.get(sessionId);
    if (metric) {
      metric.tokenUsage.inputTokens += input;
      metric.tokenUsage.outputTokens += output;
      metric.tokenUsage.totalTokens = metric.tokenUsage.inputTokens + metric.tokenUsage.outputTokens;
    }
  }

  finalizeSession(sessionId: string, startTime: number): SessionMetrics | null {
    const metric = this.metrics.get(sessionId);
    if (metric) {
      metric.sessionDurationMs = Date.now() - startTime;
      metric.connectionStatus = 'disconnected';
      return metric;
    }
    return null;
  }
}

export const metricsCollector = new MetricsCollector();
