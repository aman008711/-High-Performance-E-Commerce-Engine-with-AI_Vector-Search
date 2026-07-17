import Redis from 'ioredis';
import { env } from './env';

let isAvailable = false;

// Resilient connection retrying rules with maximum cap limits
const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null, // Avoid breaking client queries immediately on retry
  retryStrategy(times) {
    // Exponential delay with a maximum boundary of 3 seconds
    const delay = Math.min(times * 100, 3000);
    return delay;
  },
});

// Attach lifecycle events logging and availability markers
redis.on('connect', () => {
  console.log('🔄 [Redis] Establishing socket connection to server...');
});

redis.on('ready', () => {
  isAvailable = true;
  console.log('💚 [Redis] Connection ready. Caching operations active.');
});

redis.on('error', (error) => {
  isAvailable = false;
  console.error('⚠️ [Redis] Client connection error:', error.message);
});

redis.on('close', () => {
  isAvailable = false;
  console.warn('⚠️ [Redis] Socket connection closed. Caching in standby mode.');
});

redis.on('reconnecting', (delay: number) => {
  console.log(`🔄 [Redis] Reconnecting in ${delay}ms...`);
});

// Safe wrapped actions preventing errors from halting primary MongoDB routes
export const getCache = async (key: string): Promise<string | null> => {
  if (!isAvailable) return null;
  try {
    return await redis.get(key);
  } catch (error) {
    console.error(`[Redis] GET failed for key "${key}":`, error);
    return null;
  }
};

export const setCache = async (key: string, value: string, ttlSeconds: number): Promise<void> => {
  if (!isAvailable) return;
  try {
    await redis.setex(key, ttlSeconds, value);
  } catch (error) {
    console.error(`[Redis] SETEX failed for key "${key}":`, error);
  }
};

export const delCache = async (key: string): Promise<void> => {
  if (!isAvailable) return;
  try {
    await redis.del(key);
  } catch (error) {
    console.error(`[Redis] DEL failed for key "${key}":`, error);
  }
};

// Clear matching cached lists or objects using non-blocking SCAN cursors
export const delCachePattern = async (pattern: string): Promise<void> => {
  if (!isAvailable) return;
  try {
    let cursor = '0';
    do {
      const [newCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = newCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== '0');
  } catch (error) {
    console.error(`[Redis] Purge pattern "${pattern}" failed:`, error);
  }
};

export const isRedisConnected = (): boolean => {
  return isAvailable;
};

export default redis;
