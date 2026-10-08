import rateLimit from 'express-rate-limit';

/**
 * Single source of truth for rate limit key generation.
 * Where the user is authenticated, key limits by user ID, not IP.
 * Falls back to req.ip behind trust proxy.
 */
export const getRateLimitKey = (req: any): string => {
  const userId =
    req.userId ||
    req.user?.id ||
    req.auth?.userId ||
    (req.headers && req.headers['x-user-id']);

  if (userId && typeof userId === 'string' && userId.trim() !== '') {
    return `user:${userId.trim()}`;
  }
  return req.ip || '127.0.0.1';
};

/**
 * Webhook exemption checker:
 * The Vobiz KYC webhook (/api/v2/kyc/webhook/vobiz) and telephony webhooks
 * are exempted from rate limiting because they are protected by webhook signature verification.
 */
export const isWebhookExempt = (req: any): boolean => {
  const p = req.originalUrl || req.path || '';
  return (
    p.includes('/kyc/webhook/vobiz') ||
    p.includes('/telephony/webhook') ||
    p.includes('/webhooks/')
  );
};

export const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isWebhookExempt,
  keyGenerator: getRateLimitKey,
  validate: false,
  message: { success: false, error: 'Too many requests, please try again later.' },
});

export const sensitiveOperationsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isWebhookExempt,
  keyGenerator: getRateLimitKey,
  validate: false,
  message: {
    success: false,
    error: 'Rate limit exceeded for sensitive operation. Please wait before retrying.',
  },
});
