import { getSlackStatus, connectSlack, disconnectSlack, slackCallback } from '../controllers/slackController';
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { redisClient } from '../utils/redis';

jest.mock('@prisma/client', () => {
  const mPrismaClient = {
    slackConnection: {
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
      create: jest.fn(),
    }
  };
  return { PrismaClient: jest.fn(() => mPrismaClient) };
});

jest.mock('node-fetch', () => jest.fn());
import fetch from 'node-fetch';

jest.mock('../utils/redis', () => ({
  redisClient: {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
  }
}));

const prisma = new PrismaClient();

describe('Slack API', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockRequest = {
      user: { id: 'user-123' },
      query: {},
      cookies: {}
    };
    mockResponse = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
      redirect: jest.fn()
    };
    jest.clearAllMocks();
    process.env.SLACK_CLIENT_ID = 'test-client';
    process.env.SLACK_CLIENT_SECRET = 'test-secret';
    process.env.SLACK_REDIRECT_URI = 'http://localhost/callback';
    process.env.FRONTEND_URL = 'http://localhost:3000';
  });

  it('status should return isConnected true if connection exists', async () => {
    (prisma.slackConnection.findFirst as jest.Mock).mockResolvedValue({ id: 'conn-1' });
    await getSlackStatus(mockRequest as Request, mockResponse as Response);
    expect(mockResponse.json).toHaveBeenCalledWith({ isConnected: true });
    expect(prisma.slackConnection.findFirst).toHaveBeenCalledWith({ where: { userId: 'user-123' } });
  });

  it('status should return isConnected false if no connection', async () => {
    (prisma.slackConnection.findFirst as jest.Mock).mockResolvedValue(null);
    await getSlackStatus(mockRequest as Request, mockResponse as Response);
    expect(mockResponse.json).toHaveBeenCalledWith({ isConnected: false });
  });

  it('disconnect should delete many scoped to user', async () => {
    await disconnectSlack(mockRequest as Request, mockResponse as Response);
    expect(prisma.slackConnection.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-123' } });
    expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Disconnected' });
  });

  it('connectSlack should generate challenge, verifier, and set redis state', async () => {
    await connectSlack(mockRequest as Request, mockResponse as Response);
    
    expect(redisClient.set).toHaveBeenCalledTimes(1);
    const setCall = (redisClient.set as jest.Mock).mock.calls[0];
    const key = setCall[0];
    const value = JSON.parse(setCall[1]);
    
    expect(key).toMatch(/^slack_oauth_state:/);
    expect(value.userId).toBe('user-123');
    expect(value.codeVerifier).toBeDefined();
    
    const expectedChallenge = crypto
      .createHash('sha256')
      .update(value.codeVerifier)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
      
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      url: expect.stringContaining(`code_challenge=${expectedChallenge}`)
    }));
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      url: expect.stringContaining(`code_challenge_method=S256`)
    }));
    const stateVal = key.split(':')[1];
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      url: expect.stringContaining(`state=${stateVal}`)
    }));
  });

  it('slackCallback should reject missing state', async () => {
    mockRequest.query = { code: 'test-code' }; // missing state
    await slackCallback(mockRequest as Request, mockResponse as Response);
    expect(mockResponse.redirect).toHaveBeenCalledWith(expect.stringContaining('error=invalid_state'));
  });

  it('slackCallback should reject unknown state from redis', async () => {
    mockRequest.query = { code: 'test-code', state: 'wrong-state' };
    (redisClient.get as jest.Mock).mockResolvedValue(null);
    
    await slackCallback(mockRequest as Request, mockResponse as Response);
    expect(mockResponse.redirect).toHaveBeenCalledWith(expect.stringContaining('error=invalid_state'));
  });

  it('slackCallback should pass verifier and create connection using recovered userId', async () => {
    mockRequest.query = { code: 'test-code', state: 'real-state' };
    
    const storedState = JSON.stringify({ userId: 'recovered-user-id', codeVerifier: 'test-verifier' });
    (redisClient.get as jest.Mock).mockResolvedValue(storedState);
    
    (fetch as unknown as jest.Mock).mockResolvedValue({
      json: jest.fn().mockResolvedValue({
        ok: true,
        access_token: 'test-token',
        team: { id: 'team-1' }
      })
    });
    
    await slackCallback(mockRequest as Request, mockResponse as Response);
    
    expect(redisClient.del).toHaveBeenCalledWith('slack_oauth_state:real-state');
    
    expect(fetch).toHaveBeenCalled();
    const fetchCall = (fetch as unknown as jest.Mock).mock.calls[0];
    const body = fetchCall[1].body as URLSearchParams;
    expect(body.get('code_verifier')).toBe('test-verifier');
    expect(body.get('code')).toBe('test-code');
    
    expect(prisma.slackConnection.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: 'recovered-user-id'
      })
    }));
    expect(mockResponse.redirect).toHaveBeenCalledWith(expect.stringContaining('slack_connected=true'));
  });
});

