import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import redis, { isRedisConnected } from '../config/redis';

// Express-rate-limit store options
const getStore = () => {
  if (isRedisConnected()) {
    return new RedisStore({
      // @ts-ignore ioredis types compatible, but RedisStore types expect specific client interface
      sendCommand: (...args: string[]) => {
        // @ts-ignore
        return redis.call(args[0], ...args.slice(1));
      },
    });
  }
  return undefined; // Falls back to standard in-memory store if Redis is down
};

// 1. Catalog reads rate limiter: 100 requests per minute
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  store: getStore(),
  message: {
    status: 'error',
    message: 'Too many requests. Please try again later.',
  },
});

// 2. Mutations rate limiter: 10 writes per minute
export const mutationRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 writes per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  store: getStore(),
  message: {
    status: 'error',
    message: 'Too many write operations. Please try again in a minute.',
  },
});
