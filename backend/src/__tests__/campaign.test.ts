import { getCampaignById, createCampaign } from '../controllers/campaignController';
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

jest.mock('@prisma/client', () => {
  const mPrismaClient = {
    campaign: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    sender: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  return { PrismaClient: jest.fn(() => mPrismaClient) };
});

const prisma = new PrismaClient();

describe('campaignController Authorization', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockRequest = {
      user: { id: 'user-123' },
      params: { id: 'campaign-1' }
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    jest.clearAllMocks();
  });

  it('should return 404 if campaign belongs to another user', async () => {
    (prisma.campaign.findUnique as jest.Mock).mockResolvedValue({
      id: 'campaign-1',
      userId: 'different-user-456'
    });

    await getCampaignById(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Campaign not found' });
  });

  it('should return 200 if campaign belongs to authenticated user', async () => {
    (prisma.campaign.findUnique as jest.Mock).mockResolvedValue({
      id: 'campaign-1',
      userId: 'user-123',
      subject: 'Test'
    });

    await getCampaignById(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith({
      id: 'campaign-1',
      userId: 'user-123',
      subject: 'Test'
    });
  });
});

describe('createCampaign Idempotency Authorization', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockRequest = {
      user: { id: 'user-B' },
      header: jest.fn().mockReturnValue('shared-idempotency-key'),
      body: {
        senderId: '123e4567-e89b-12d3-a456-426614174000',
        subject: 'Test',
        body: 'Test',
        recipients: ['test@example.com']
      }
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    jest.clearAllMocks();
  });

  it('should NOT return User A campaign to User B using the same idempotency key', async () => {
    // findFirst will return null for User B because the campaign belongs to User A
    (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(null);
    
    // Allow the sender lookup to fail to avoid mocking the whole transaction
    (prisma.sender.findUnique as jest.Mock).mockResolvedValue(null);

    await createCampaign(mockRequest as Request, mockResponse as Response);

    // It should NOT return 200 with the existing campaign.
    // Because sender is not found (or not owned), it should return 404 sender not found
    // which proves it bypassed the idempotency early-return.
    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Sender not found or not owned by user' });
  });

  it('should return the campaign if the idempotency key belongs to the authenticated user', async () => {
    // findFirst returns the campaign for User B
    (prisma.campaign.findFirst as jest.Mock).mockResolvedValue({
      id: 'campaign-2',
      userId: 'user-B',
      idempotencyKey: 'shared-idempotency-key',
      emails: [{}, {}] // mock 2 emails
    });

    await createCampaign(mockRequest as Request, mockResponse as Response);

    // It should early return 200 with the existing campaign
    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith({
      campaignId: 'campaign-2',
      total: 2,
      scheduled: 2,
      message: 'Returned existing campaign based on Idempotency-Key'
    });
  });
});
