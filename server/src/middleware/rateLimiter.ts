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

/**
 * Dedicated Webhook Rate Limiter: Max 100 requests per IP per 15 minutes.
 * Defends payment gateway webhook callback ingress against denial-of-service and flood attacks.
 */
export const webhookRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || '127.0.0.1',
  validate: false,
  message: {
    success: false,
    error: 'WEBHOOK_RATE_LIMIT_EXCEEDED',
    message: 'Too many webhook requests from this IP address. Webhook ingress is rate limited to 100 requests per 15 minutes.',
  },
});

/**
 * Strict Signup Rate Limiter: Max 5 signup / registration validation attempts per IP per hour.
 */
export const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || '127.0.0.1',
  validate: false,
  message: {
    success: false,
    error: 'SIGNUP_RATE_LIMIT_EXCEEDED',
    message: 'Too many signup attempts from this IP address. Please wait an hour before trying again.',
  },
});

/**
 * Strict Login / Auth Rate Limiter: Max 10 authentication attempts per IP per hour.
 */
export const loginLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || '127.0.0.1',
  validate: false,
  message: {
    success: false,
    error: 'AUTH_RATE_LIMIT_EXCEEDED',
    message: 'Too many authentication attempts. Please wait before trying again.',
  },
});

// In-memory atomic tracker to prevent simultaneous race condition signups from the same IP
const lastIpSignupAttempt = new Map<string, number>();

/**
 * IP Throttle Delay: Enforces a 1.5-second pacing delay between signup submissions
 * and serializes concurrent race conditions from the same IP address.
 */
export const authIpThrottleDelay = async (req: any, res: any, next: any) => {
  const ip = req.ip || '127.0.0.1';
  const now = Date.now();
  const lastAttempt = lastIpSignupAttempt.get(ip) || 0;

  if (now - lastAttempt < 1500) {
    res.status(429).json({
      success: false,
      error: 'RACE_CONDITION_THROTTLED',
      message: 'Signup requests are being submitted too rapidly. Please wait 2 seconds.',
    });
    return;
  }

  lastIpSignupAttempt.set(ip, now);
  // Add a defensive 1000ms delay to thwart automated race scripts
  await new Promise((resolve) => setTimeout(resolve, 1000));
  next();
};
