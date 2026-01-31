import { Request, Response, NextFunction } from 'express';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore: Map<string, RateLimitEntry> = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000);

export function createRateLimiter(config: RateLimitConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.tenant?.id || req.ip}:${req.path}`;
    const now = Date.now();
    
    let entry = rateLimitStore.get(key);
    
    if (!entry || entry.resetAt < now) {
      entry = {
        count: 0,
        resetAt: now + config.windowMs,
      };
      rateLimitStore.set(key, entry);
    }
    
    entry.count++;
    
    const remaining = Math.max(0, config.maxRequests - entry.count);
    const resetInSeconds = Math.ceil((entry.resetAt - now) / 1000);
    
    res.setHeader('X-RateLimit-Limit', config.maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    res.setHeader('X-RateLimit-Reset', resetInSeconds.toString());
    
    if (entry.count > config.maxRequests) {
      return res.status(429).json({
        error: 'RATE_LIMITED',
        message: 'Too many requests',
        retryAfter: resetInSeconds,
      });
    }
    
    next();
  };
}

export const standardRateLimit = createRateLimiter({
  windowMs: 60000,
  maxRequests: 60,
});

export const strictRateLimit = createRateLimiter({
  windowMs: 60000,
  maxRequests: 10,
});

export const pollingRateLimit = createRateLimiter({
  windowMs: 60000,
  maxRequests: 120,
});
