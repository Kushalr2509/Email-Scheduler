import { requireAuth } from '../middleware/authMiddleware';
import { getMe } from '../controllers/authController';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

jest.mock('jsonwebtoken');

describe('Auth Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockRequest = {};
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    nextFunction = jest.fn();
  });

  it('should return 401 if no auth_token cookie', () => {
    mockRequest.cookies = {};
    requireAuth(mockRequest as Request, mockResponse as Response, nextFunction);
    
    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('should return 401 if token is invalid', () => {
    mockRequest.cookies = { auth_token: 'invalid_token' };
    (jwt.verify as jest.Mock).mockImplementation(() => { throw new Error('Invalid token'); });
    
    requireAuth(mockRequest as Request, mockResponse as Response, nextFunction);
    
    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('should call next() if token is valid', () => {
    mockRequest.cookies = { auth_token: 'valid_token' };
    (jwt.verify as jest.Mock).mockReturnValue({ userId: 'user-123' });
    
    requireAuth(mockRequest as Request, mockResponse as Response, nextFunction);
    
    expect(mockRequest.user?.id).toBe('user-123');
    expect(nextFunction).toHaveBeenCalled();
  });
});

describe('getMe controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockRequest = {};
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  it('should return 401 if req.user is undefined', async () => {
    await getMe(mockRequest as Request, mockResponse as Response);
    
    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Not authenticated' });
  });
});
