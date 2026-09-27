import { Request, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { emailQueue } from '../queues/emailQueue';
import { normalizeAndDeduplicateEmails, generateIdempotencyKey, validateIdempotencyKeyHeader } from '../utils/helpers';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

const createCampaignSchema = z.object({
  senderId: z.string().uuid(),
  subject: z.string().min(1),
  body: z.string().min(1),
  recipients: z.array(z.string().email()).min(1),
  startAt: z.string().datetime().optional(),
  delayMs: z.number().int().min(0).default(5000),
  hourlyLimit: z.number().int().min(1).default(100),
  attachments: z.array(
    z.object({
      filename: z.string(),
      content: z.string(),
      contentType: z.string(),
      size: z.number().optional(),
    })
  ).optional(),
});

export const createCampaign = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    let idempotencyKey: string | undefined;
    
    try {
      idempotencyKey = validateIdempotencyKeyHeader(req.header('Idempotency-Key'));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
      return;
    }

    // Check for API Request Idempotency early before processing
    if (idempotencyKey) {
      const existingCampaign = await prisma.campaign.findFirst({
        where: { idempotencyKey, userId },
        include: { emails: true }
      });

      if (existingCampaign) {
        res.status(200).json({
          campaignId: existingCampaign.id,
          total: existingCampaign.emails.length,
          scheduled: existingCampaign.emails.length,
          message: 'Returned existing campaign based on Idempotency-Key'
        });
        return;
      }
    }

    const parsed = createCampaignSchema.safeParse(req.body);
    
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error });
      return;
    }

    const { senderId, subject, body, recipients, startAt, delayMs, hourlyLimit, attachments } = parsed.data;

    // Enforce sender.userId === authenticatedUser.id
    const sender = await prisma.sender.findUnique({ where: { id: senderId } });
    if (!sender || sender.userId !== userId) {
      res.status(404).json({ error: 'Sender not found or not owned by user' });
      return;
    }

    const normalizedRecipients = normalizeAndDeduplicateEmails(recipients);

    if (normalizedRecipients.length === 0) {
      res.status(400).json({ error: 'No valid recipients provided after normalization' });
      return;
    }

    // Transaction for campaign and emails
    const result = await prisma.$transaction(async (tx) => {
      const campaign = await tx.campaign.create({
        data: {
          userId: sender.userId,
          senderId,
          subject,
          body,
          startAt: startAt ? new Date(startAt) : new Date(),
          delayMs,
          hourlyLimit,
          idempotencyKey,
          attachments: attachments ? (attachments as any) : null,
        }
      });

      const campaignStartTime = startAt ? new Date(startAt).getTime() : Date.now();

      const emailsToCreate = normalizedRecipients.map((recipient, index) => {
        const scheduledTimeMs = campaignStartTime + index * delayMs;
        return {
          campaignId: campaign.id,
          senderId,
          recipient,
          subject,
          body,
          idempotencyKey: generateIdempotencyKey(campaign.id, recipient),
          attachments: attachments ? (attachments as any) : null,
          status: 'SCHEDULED' as const,
          scheduledAt: new Date(scheduledTimeMs),
        };
      });

      // Create many to avoid N inserts
      await tx.email.createMany({
        data: emailsToCreate,
        skipDuplicates: true // in case idempotency keys conflict
      });

      // Fetch created emails to get their IDs
      const createdEmails = await tx.email.findMany({
        where: { campaignId: campaign.id }
      });

      return { campaign, createdEmails };
    });

    // Enqueue jobs
    // Note: The boundary between PostgreSQL transaction (above) and BullMQ enqueue (below) is not strictly atomic.
    // If addBulk fails here, PostgreSQL contains SCHEDULED emails with no matching BullMQ jobs.
    // For this milestone, we accept this limitation.
    const jobs = result.createdEmails.map((email) => {
      const scheduledTimeMs = email.scheduledAt ? email.scheduledAt.getTime() : Date.now();
      const delayUntilExecution = Math.max(0, scheduledTimeMs - Date.now());

      return {
        name: 'send-email',
        data: { emailId: email.id },
        opts: {
          delay: delayUntilExecution,
          jobId: `email-${email.id}`, // deterministic job id
        }
      };
    });

    await emailQueue.addBulk(jobs);

    res.status(201).json({
      campaignId: result.campaign.id,
      total: normalizedRecipients.length,
      scheduled: result.createdEmails.length,
    });
  } catch (error: any) {
    if (error.code === 'P2002' && req.header('Idempotency-Key')) {
      // Handle concurrent idempotency creation race condition
      try {
        const key = validateIdempotencyKeyHeader(req.header('Idempotency-Key'));
        if (key) {
          const existingCampaign = await prisma.campaign.findFirst({
            where: { idempotencyKey: key, userId },
            include: { emails: true }
          });
          
          if (existingCampaign) {
            res.status(200).json({
              campaignId: existingCampaign.id,
              total: existingCampaign.emails.length,
              scheduled: existingCampaign.emails.length,
              message: 'Returned existing campaign based on Idempotency-Key'
            });
            return;
          }
        }
      } catch (e) {
        // Validation error during concurrent fallback; fall through to 500
      }
    }
    
    logger.error('Failed to create campaign', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getScheduledCampaigns = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: 'Authentication required' }); return; }

  try {
    const campaigns = await prisma.campaign.findMany({
      where: { userId },
      include: {
        emails: {
          where: { status: { in: ['SCHEDULED', 'QUEUED', 'RETRY_WAIT'] } },
          select: { recipient: true, subject: true, scheduledAt: true, status: true },
          take: 10, // Just returning top 10 for lightweight UI
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json(campaigns);
  } catch (error) {
    logger.error('Failed to fetch scheduled campaigns', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getSentCampaigns = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: 'Authentication required' }); return; }

  try {
    const campaigns = await prisma.campaign.findMany({
      where: { userId },
      include: {
        emails: {
          where: { status: { in: ['SENT', 'FAILED'] } },
          select: { recipient: true, subject: true, sentAt: true, status: true },
          take: 10,
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json(campaigns);
  } catch (error) {
    logger.error('Failed to fetch sent campaigns', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getCampaignById = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: 'Authentication required' }); return; }

  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: req.params.id as string },
      include: {
        sender: true,
        emails: { select: { recipient: true, subject: true, status: true, sentAt: true, scheduledAt: true } }
      }
    });

    if (!campaign || campaign.userId !== userId) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    res.status(200).json(campaign);
  } catch (error) {
    logger.error('Failed to fetch campaign details', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
