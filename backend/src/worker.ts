import { Worker, Job, DelayedError } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { EMAIL_QUEUE_NAME } from './queues/emailQueue';
import { redisClient } from './utils/redis';
import { checkRateLimit } from './services/rateLimitService';
import { sendEmail } from './services/emailService';
import { sendSlackNotification } from './services/slackService';
import { indexEmail } from './services/elasticsearchService';
import { reconcileScheduledEmails } from './services/schedulerReconciliationService';
import { logger } from './utils/logger';

dotenv.config();

const prisma = new PrismaClient();
const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '5', 10);

const worker = new Worker(
  EMAIL_QUEUE_NAME,
  async (job: Job) => {
    const { emailId } = job.data;
    logger.info(`[worker] Job ${job.id} started for email ${emailId}`);

    // We include PROCESSING only if it's stale (e.g. processingAt is older than 5 minutes) to allow crash recovery.
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const claimResult = await prisma.email.updateMany({
      where: {
        id: emailId,
        OR: [
          { status: { in: ['SCHEDULED', 'QUEUED', 'RETRY_WAIT'] } },
          { status: 'PROCESSING', bullJobId: job.id },
          { status: 'PROCESSING', bullJobId: { not: job.id }, processingAt: { lt: fiveMinutesAgo } }
        ]
      },
      data: {
        status: 'PROCESSING',
        processingAt: new Date(),
        bullJobId: job.id,
      },
    });

    if (claimResult.count === 0) {
      logger.warn(`[worker] Email ${emailId} cannot be claimed (already SENT/FAILED, or missing). Skipping duplicate execution.`);
      return;
    }

    // Now safely fetch the claimed email and its relations
    const email = await prisma.email.findUnique({
      where: { id: emailId },
      include: { campaign: true, sender: true }
    });

    if (!email) {
      // Edge case: deleted between claim and read
      return;
    }

    const { hourlyLimit, delayMs = 0 } = email.campaign;

    // Apply rate limit check
    const rateLimit = await checkRateLimit(email.senderId, hourlyLimit, delayMs);

    if (rateLimit.status === 'INFRASTRUCTURE_ERROR') {
      logger.error(`[worker] Redis infrastructure failure while checking rate limit for sender ${email.senderId}`);
      // Throw standard error so BullMQ triggers exponential backoff instead of failing silently or wrongly delaying
      throw rateLimit.error;
    }

    if (rateLimit.status === 'RATE_LIMITED') {
      const delayUntilExecution = Math.max(0, rateLimit.retryAt - Date.now());
      logger.info(`[worker] Rate limit reached for sender ${email.senderId}. Delaying email ${email.id} by ${delayUntilExecution}ms`);

      await prisma.email.update({
        where: { id: email.id },
        data: { status: 'RETRY_WAIT', processingAt: null }
      });

      const retryDate = new Date(Date.now() + delayUntilExecution).toLocaleString();
      const currentHour = new Date().toISOString().substring(0, 13); // e.g. "2023-10-05T14"
      const slackDedupKey = `slack-notified:${email.senderId}:${currentHour}`;

      try {
        const setNx = await redisClient.set(slackDedupKey, '1', 'EX', 3600, 'NX');
        if (setNx === 'OK') {
          const slackMessage = `Email rate limit reached for ${email.sender.email}. Hourly limit: ${hourlyLimit}. Email scheduling has been deferred until the next available window (${retryDate}).`;
          sendSlackNotification(email.campaign.userId, slackMessage).catch(err => {
            logger.error(`[worker] Failed to send slack notification for ${email.id}`, err);
          });
        }
      } catch (err) {
        logger.error('[worker] Failed to deduplicate slack notification', err);
      }

      await job.moveToDelayed(Date.now() + delayUntilExecution, job.token!);
      throw new DelayedError();
    }

    if (rateLimit.status === 'DELAYED') {
      const delayUntilExecution = Math.max(0, rateLimit.retryAt - Date.now());
      logger.info(`[worker] Minimum delay enforced for sender ${email.senderId}. Delaying email ${email.id} by ${delayUntilExecution}ms`);

      await prisma.email.update({
        where: { id: email.id },
        data: { status: 'RETRY_WAIT', processingAt: null }
      });

      await job.moveToDelayed(Date.now() + delayUntilExecution, job.token!);
      throw new DelayedError();
    }

    try {
      // Send through Ethereal SMTP
      const messageId = await sendEmail(
        email.recipient,
        email.subject,
        email.body,
        email.sender.email,
        email.attachments ? (email.attachments as any[]) : undefined
      );

      // Update PostgreSQL
      const sentEmail = await prisma.email.update({
        where: { id: email.id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          messageId,
          attempts: { increment: 1 }
        }
      });

      logger.info(`[worker] Email sent ${email.id} to ${email.recipient}`);
      
      // Index to Elasticsearch
      await indexEmail(sentEmail, email.campaign.userId);
    } catch (error) {
      logger.error(`[worker] Email failed ${email.id}`, error);
      
      await prisma.email.update({
        where: { id: email.id },
        data: {
          status: 'QUEUED', // will be retried by BullMQ backoff
          attempts: { increment: 1 }
        }
      });
      
      throw error;
    }
  },
  {
    connection: redisClient,
    concurrency: WORKER_CONCURRENCY,
  }
);

worker.on('failed', async (job, err) => {
  if (job && !(err instanceof DelayedError)) {
    if (job.attemptsMade >= job.opts.attempts!) {
      await prisma.email.updateMany({
        where: { id: job.data.emailId, status: { not: 'SENT' } },
        data: { status: 'FAILED' }
      });
      logger.error(`[worker] Email permanently failed ${job.data.emailId}`);

      // We need userId to index it, so let's fetch it
      const failedEmail = await prisma.email.findUnique({
        where: { id: job.data.emailId },
        include: { campaign: true }
      });
      if (failedEmail) {
        await indexEmail(failedEmail, failedEmail.campaign.userId);
      }
    }
  }
});

worker.on('ready', () => {
  logger.info(`Worker started with concurrency ${WORKER_CONCURRENCY}`);
  reconcileScheduledEmails().catch(err => {
    logger.error('Failed to reconcile scheduled emails on startup', err);
  });
});

process.on('SIGINT', async () => {
  logger.info('Shutting down worker...');
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
});
