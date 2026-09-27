import Redis from 'ioredis';
import dotenv from 'dotenv';
import { logger } from './logger';

dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redisClient = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
});

redisClient.on('error', (err) => {
  logger.error('Redis connection error', err);
});
