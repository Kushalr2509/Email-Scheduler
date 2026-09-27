import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const app = express();
const prisma = new PrismaClient();

import authRoutes from './routes/authRoutes';
import campaignRoutes from './routes/campaignRoutes';
import senderRoutes from './routes/senderRoutes';
import slackRoutes from './routes/slackRoutes';
import searchRoutes from './routes/searchRoutes';
import { redisClient } from './utils/redis';
import { emailQueue } from './queues/emailQueue';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { requireAuth } from './middleware/authMiddleware';
import { setupElasticsearch } from './services/elasticsearchService';

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

app.use(cors({
  origin: frontendUrl,
  credentials: true,
}));
app.use(helmet());
app.use(express.json());
app.use(cookieParser());

// Debug logger
app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.originalUrl}`);
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/senders', senderRoutes);
app.use('/api/slack', slackRoutes);
app.use('/api/search', searchRoutes);

// Setup Bull Board
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter: serverAdapter,
  options: {
    uiConfig: {
      boardTitle: 'Email scheduler'
    }
  }
});

app.use('/admin/queues', (req, res, next) => {
  if (req.originalUrl === '/admin/queues') {
    return res.redirect(301, '/admin/queues/');
  }
  next();
}, requireAuth, (req, res, next) => {
  // Remove Helmet's strict headers specifically for Bull Board
  res.removeHeader('Content-Security-Policy');
  res.removeHeader('X-Content-Type-Options');
  next();
}, serverAdapter.getRouter());

// Basic health endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Check DB connection
    await prisma.$queryRaw`SELECT 1`;
    // Check Redis connection
    await redisClient.ping();
    res.status(200).json({ status: 'ok', db: 'connected', redis: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'error', db: 'disconnected or redis disconnected' });
  }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, async () => {
  await setupElasticsearch();
  console.log(`Server is running on port ${PORT}`);
});
