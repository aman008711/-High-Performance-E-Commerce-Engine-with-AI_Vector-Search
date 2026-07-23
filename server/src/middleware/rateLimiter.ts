import { Request, Response, NextFunction } from 'express';
import { getCache, setCache, isRedisConnected } from '../config/redis';

export const apiRateLimiter = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // If Redis is offline, bypass rate limiting gracefully
  if (!isRedisConnected()) {
    return next();
  }

  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const key = `ratelimit:${ip}`;

  try {
    const record = await getCache(key);
    const currentRequestCount = record ? parseInt(record, 10) : 0;

    // Rate Limit: 100 requests per minute
    if (currentRequestCount >= 100) {
      res.status(429).json({
        status: 'error',
        message: 'Too many requests. Please try again later.',
      });
      return;
    }

    const newCount = currentRequestCount + 1;

    if (currentRequestCount === 0) {
      // Set value with a TTL of 60 seconds
      await setCache(key, '1', 60);
    } else {
      // Retain/overwrite key with incremented count (with a TTL of 60 seconds)
      await setCache(key, newCount.toString(), 60);
    }

    next();
  } catch (error) {
    // Fail soft to database operations if rate limiting encounters errors
    next();
  }
};
