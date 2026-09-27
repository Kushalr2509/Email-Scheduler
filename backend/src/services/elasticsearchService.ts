import { Client } from '@elastic/elasticsearch';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';

dotenv.config();

const ELASTICSEARCH_URL = process.env.ELASTICSEARCH_URL;
const INDEX_NAME = 'emails';

export const esClient = ELASTICSEARCH_URL ? new Client({ node: ELASTICSEARCH_URL }) : null;
const prisma = new PrismaClient();

export const setupElasticsearch = async () => {
  if (!esClient) {
    logger.warn('[Elasticsearch] URL not provided, skipping setup.');
    return;
  }

  try {
    const exists = await esClient.indices.exists({ index: INDEX_NAME });
    if (!exists) {
      await esClient.indices.create({
        index: INDEX_NAME,
        mappings: {
          properties: {
            id: { type: 'keyword' },
            campaignId: { type: 'keyword' },
            userId: { type: 'keyword' },
            senderId: { type: 'keyword' },
            recipient: { type: 'text' },
            subject: { type: 'text' },
            body: { type: 'text' },
            status: { type: 'keyword' },
            scheduledAt: { type: 'date' },
            sentAt: { type: 'date' },
            createdAt: { type: 'date' }
          }
        }
      });
      logger.info(`[Elasticsearch] Index ${INDEX_NAME} created.`);
    }
  } catch (error: any) {
    logger.error(`[Elasticsearch] Setup failed: ${error.message}`);
  }
};

export const indexEmail = async (email: any, userId: string) => {
  if (!esClient) return;

  try {
    await esClient.index({
      index: INDEX_NAME,
      id: email.id,
      document: {
        id: email.id,
        campaignId: email.campaignId,
        userId: userId,
        senderId: email.senderId,
        recipient: email.recipient,
        subject: email.subject,
        body: email.body,
        status: email.status,
        scheduledAt: email.scheduledAt,
        sentAt: email.sentAt,
        createdAt: email.createdAt
      }
    });
  } catch (error: any) {
    logger.error(`[Elasticsearch] Failed to index email ${email.id}: ${error.message}`);
    // Non-blocking, do not throw.
  }
};

export const searchEmails = async (userId: string, query: string) => {
  if (!esClient) {
    throw new Error('Search is temporarily unavailable');
  }

  try {
    const { hits } = await esClient.search({
      index: INDEX_NAME,
      query: {
        bool: {
          must: [
            { term: { userId: userId } }
          ],
          should: [
            { match: { recipient: query } },
            { match: { subject: query } },
            { match: { body: query } }
          ],
          minimum_should_match: query ? 1 : 0
        }
      },
      sort: [
        { createdAt: { order: 'desc' } }
      ],
      size: 50
    });

    return hits.hits.map((h: any) => h._source);
  } catch (error: any) {
    logger.error(`[Elasticsearch] Search failed: ${error.message}`);
    throw new Error('Search is temporarily unavailable');
  }
};

export const bulkIndexExisting = async () => {
  if (!esClient) return;
  try {
    const emails = await prisma.email.findMany({
      include: { campaign: true }
    });

    for (const email of emails) {
      await indexEmail(email, email.campaign.userId);
    }
    logger.info(`[Elasticsearch] Bulk indexed ${emails.length} emails.`);
  } catch (error: any) {
    logger.error(`[Elasticsearch] Bulk index failed: ${error.message}`);
  }
};
