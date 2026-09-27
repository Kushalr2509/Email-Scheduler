import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import fetch from 'node-fetch';
import { redisClient } from '../utils/redis';

const prisma = new PrismaClient();

export const getSlackStatus = async (req: Request, res: Response) => {
  try {
    const connection = await prisma.slackConnection.findFirst({
      where: { userId: req.user!.id }
    });
    return res.json({ isConnected: !!connection });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const connectSlack = async (req: Request, res: Response) => {
  const state = crypto.randomBytes(32).toString('hex');
  const codeVerifier = crypto.randomBytes(32).toString('hex');
  
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  await redisClient.set(
    `slack_oauth_state:${state}`,
    JSON.stringify({ userId: req.user!.id, codeVerifier }),
    'EX',
    600 // 10 minutes
  );

  const clientId = process.env.SLACK_CLIENT_ID;
  const redirectUri = process.env.SLACK_REDIRECT_URI;
  
  if (!clientId || !redirectUri) {
    return res.status(500).json({ error: 'Slack credentials not configured' });
  }

  const url = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=chat:write&redirect_uri=${redirectUri}&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256`;
  res.json({ url });
};

export const slackCallback = async (req: Request, res: Response) => {
  const { code, state, error } = req.query;
  
  if (error) {
    return res.redirect(`${process.env.FRONTEND_URL}/dashboard/settings?error=${error}`);
  }

  if (!state || typeof state !== 'string') {
    return res.redirect(`${process.env.FRONTEND_URL}/dashboard/settings?error=invalid_state`);
  }

  const redisKey = `slack_oauth_state:${state}`;
  const storedDataStr = await redisClient.get(redisKey);
  
  if (!storedDataStr) {
    return res.redirect(`${process.env.FRONTEND_URL}/dashboard/settings?error=invalid_state`);
  }

  // Delete immediately to prevent replay
  await redisClient.del(redisKey);

  let storedData;
  try {
    storedData = JSON.parse(storedDataStr);
  } catch (e) {
    return res.redirect(`${process.env.FRONTEND_URL}/dashboard/settings?error=invalid_state`);
  }

  const { userId, codeVerifier } = storedData;

  if (!userId || !codeVerifier) {
    return res.redirect(`${process.env.FRONTEND_URL}/dashboard/settings?error=missing_verifier`);
  }

  try {
    const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: process.env.SLACK_CLIENT_ID!,
        client_secret: process.env.SLACK_CLIENT_SECRET!,
        code: code as string,
        redirect_uri: process.env.SLACK_REDIRECT_URI!,
        code_verifier: codeVerifier
      })
    });

    const data = await tokenResponse.json();

    if (!data.ok) {
      return res.redirect(`${process.env.FRONTEND_URL}/dashboard/settings?error=${data.error}`);
    }

    const accessToken = data.access_token;
    const teamId = data.team?.id;
    // Some scopes return incoming_webhook with channel_id
    const channelId = data.incoming_webhook?.channel_id || data.authed_user?.id;

    // Delete existing connection if any
    await prisma.slackConnection.deleteMany({
      where: { userId }
    });

    await prisma.slackConnection.create({
      data: {
        userId,
        accessToken,
        teamId,
        channelId
      }
    });

    return res.redirect(`${process.env.FRONTEND_URL}/dashboard/settings?slack_connected=true`);
  } catch (err: any) {
    console.error('Slack OAuth Error:', err);
    return res.redirect(`${process.env.FRONTEND_URL}/dashboard/settings?error=internal_error`);
  }
};

export const disconnectSlack = async (req: Request, res: Response) => {
  try {
    await prisma.slackConnection.deleteMany({
      where: { userId: req.user!.id }
    });
    return res.json({ message: 'Disconnected' });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};
