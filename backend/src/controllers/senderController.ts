import { Request, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

const createSenderSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
});

export const getSenders = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const senders = await prisma.sender.findMany({
      where: { userId },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      }
    });

    res.status(200).json(senders);
  } catch (error) {
    logger.error('Failed to get senders', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createSender = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const parsed = createSenderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error });
      return;
    }

    const { email, name } = parsed.data;

    const sender = await prisma.sender.create({
      data: {
        userId,
        email,
        name,
      }
    });

    res.status(201).json(sender);
  } catch (error) {
    logger.error('Failed to create sender', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
