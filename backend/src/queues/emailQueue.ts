import { Queue } from 'bullmq';
import { redisClient } from '../utils/redis';

export const EMAIL_QUEUE_NAME = 'email-sending';

/**
 * BullMQ Email Queue Configuration
 * 
 * Retry Behavior:
 * - We configure explicit retry attempts with exponential backoff.
 * - By default, an error thrown in the worker (e.g. SMTP failure) will trigger this backoff.
 * - Permanent/validation errors should not trigger retries, but for our simple SMTP worker,
 *   most errors are considered transient network/SMTP failures.
 * - If the limit is exceeded (attempts >= 3), the worker's 'failed' event marks the DB state as FAILED.
 */
export const emailQueue = new Queue(EMAIL_QUEUE_NAME, {
  connection: redisClient,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});
