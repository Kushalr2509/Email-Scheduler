import { sendSlackNotification } from '../services/slackService';
import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';

jest.mock('@prisma/client', () => {
  const mPrismaClient = {
    slackConnection: {
      findFirst: jest.fn(),
    }
  };
  return { PrismaClient: jest.fn(() => mPrismaClient) };
});

jest.mock('node-fetch');

const prisma = new PrismaClient();
const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('slackService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not throw if user is disconnected', async () => {
    (prisma.slackConnection.findFirst as jest.Mock).mockResolvedValue(null);
    
    // Should resolve successfully without throwing
    await expect(sendSlackNotification('user-1', 'Test')).resolves.toBeUndefined();
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it('should not throw if fetch fails (API error)', async () => {
    (prisma.slackConnection.findFirst as jest.Mock).mockResolvedValue({
      userId: 'user-1',
      accessToken: 'token',
      channelId: 'chan-1'
    });
    
    mockedFetch.mockRejectedValue(new Error('Network error'));
    
    await expect(sendSlackNotification('user-1', 'Test')).resolves.toBeUndefined();
    expect(mockedFetch).toHaveBeenCalled();
  });
});
