import Redis, { Cluster } from 'ioredis';
import { env } from './env';

let isAvailable = false;
let redis: Redis | Cluster;

const maxRetriesPerRequest = null;
const retryStrategy = (times: number) => {
  const delay = Math.min(times * 100, 3000);
  return delay;
};

// Check connection client mode rules (Cluster vs Sentinel vs Standalone)
const redisMode = process.env.REDIS_MODE || 'standalone';

if (redisMode === 'cluster') {
  console.log('🔄 [Redis] Initializing connection client in CLUSTER mode...');
  const nodeStrings = (process.env.REDIS_CLUSTER_NODES || 'localhost:6379').split(',');
  const nodes = nodeStrings.map((str) => {
    const [host, port] = str.split(':');
    return { host, port: parseInt(port, 10) || 6379 };
  });

  redis = new Cluster(nodes, {
    redisOptions: {
      maxRetriesPerRequest,
    },
  });
} else if (process.env.REDIS_SENTINELS) {
  console.log('🔄 [Redis] Initializing connection client in SENTINEL mode...');
  const sentinelStrings = process.env.REDIS_SENTINELS.split(',');
  const sentinels = sentinelStrings.map((str) => {
    const [host, port] = str.split(':');
    return { host, port: parseInt(port, 10) || 26379 };
  });

  redis = new Redis({
    sentinels,
    name: process.env.REDIS_SENTINEL_MASTER_NAME || 'mymaster',
    maxRetriesPerRequest,
    retryStrategy,
  });
} else {
  // Standalone connection mode (default)
  redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest,
    retryStrategy,
  });
}

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

// Clear matching cached lists or objects using non-blocking SCAN cursors (Cluster-safe)
export const delCachePattern = async (pattern: string): Promise<void> => {
  if (!isAvailable) return;
  try {
    const isCluster = redis instanceof Cluster;
    if (isCluster) {
      const cluster = redis as Cluster;
      const masters = cluster.nodes('master');
      
      for (const node of masters) {
        let cursor = '0';
        do {
          const [newCursor, keys] = await node.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
          cursor = newCursor;
          if (keys.length > 0) {
            await cluster.del(...keys);
          }
        } while (cursor !== '0');
      }
    } else {
      const client = redis as Redis;
      let cursor = '0';
      do {
        const [newCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = newCursor;
        if (keys.length > 0) {
          await client.del(...keys);
        }
      } while (cursor !== '0');
    }
  } catch (error) {
    console.error(`[Redis] Purge pattern "${pattern}" failed:`, error);
  }
};

export const isRedisConnected = (): boolean => {
  return isAvailable;
};

export default redis;
