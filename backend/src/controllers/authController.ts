import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be defined in production');
}
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-default-key-for-dev';

export const googleLogin = (req: Request, res: Response) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_CALLBACK_URL;
  
  if (!clientId || !redirectUri) {
    res.status(500).json({ error: 'OAuth not configured' });
    return;
  }

  // Create state to protect against CSRF
  const state = crypto.randomBytes(32).toString('hex');
  res.cookie('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 10 * 60 * 1000, // 10 mins
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid%20email%20profile&state=${state}`;
  res.redirect(authUrl);
};

export const googleCallback = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, state, error } = req.query;
    
    if (error) {
      res.status(400).json({ error: 'OAuth flow failed' });
      return;
    }

    const savedState = req.cookies.oauth_state;
    if (!state || state !== savedState) {
      res.status(400).json({ error: 'Invalid OAuth state' });
      return;
    }

    res.clearCookie('oauth_state');

    const clientId = process.env.GOOGLE_CLIENT_ID!;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
    const redirectUri = process.env.GOOGLE_CALLBACK_URL!;

    // Exchange code for token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: code as string,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) {
      logger.error('Google token error', tokenData);
      res.status(400).json({ error: 'Failed to exchange token' });
      return;
    }

    // Get user info
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    const userData = await userResponse.json();
    if (!userResponse.ok) {
      res.status(400).json({ error: 'Failed to fetch user info' });
      return;
    }

    // Find or create user
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {
        googleId: userData.id,
        name: userData.name,
        avatarUrl: userData.picture,
      },
      create: {
        email: userData.email,
        googleId: userData.id,
        name: userData.name,
        avatarUrl: userData.picture,
      }
    });

    // Create session
    const jwtToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.cookie('auth_token', jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/dashboard`);
  } catch (err) {
    logger.error('Google callback error', err);
    res.status(500).json({ error: 'Internal server error during auth' });
  }
};

export const logout = (req: Request, res: Response) => {
  res.clearCookie('auth_token');
  res.status(200).json({ message: 'Logged out successfully' });
};

export const getMe = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true
      }
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.status(200).json(user);
  } catch (error) {
    logger.error('Failed to get me', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
