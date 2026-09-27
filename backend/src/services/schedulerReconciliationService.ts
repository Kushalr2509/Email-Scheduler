import { PrismaClient } from '@prisma/client';
import { emailQueue } from '../queues/emailQueue';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export async function reconcileScheduledEmails() {
  logger.info('[SchedulerReconciliation] Starting startup reconciliation...');
  
  try {
    const BATCH_SIZE = 500;
    let offset = 0;
    let hasMore = true;
    let reconciledCount = 0;

    while (hasMore) {
      const scheduledEmails = await prisma.email.findMany({
        where: { status: 'SCHEDULED' },
        take: BATCH_SIZE,
        skip: offset,
        orderBy: { id: 'asc' }
      });

      if (scheduledEmails.length === 0) {
        hasMore = false;
        break;
      }

      for (const email of scheduledEmails) {
        const jobId = `email-${email.id}`;
        
        // BullMQ provides getJob() to safely check if a deterministic job exists across all queue states.
        const existingJob = await emailQueue.getJob(jobId);
        
        if (!existingJob) {
          const delay = Math.max(0, (email.scheduledAt?.getTime() || Date.now()) - Date.now());
          
          await emailQueue.add('send-email', { emailId: email.id }, {
            jobId: jobId,
            delay: delay,
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 5000,
            }
          });
          
          logger.info(`[SchedulerReconciliation] Recovered missing BullMQ job ${jobId} for email ${email.id}`);
          reconciledCount++;
        }
      }

      offset += scheduledEmails.length;
    }

    logger.info(`[SchedulerReconciliation] Reconciliation complete. Recovered ${reconciledCount} missing jobs.`);
  } catch (error) {
    logger.error('[SchedulerReconciliation] Error during reconciliation:', error);
  }
}
