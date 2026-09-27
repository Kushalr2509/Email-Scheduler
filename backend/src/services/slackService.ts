import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';

const prisma = new PrismaClient();

export const sendSlackNotification = async (userId: string, message: string) => {
  try {
    const connection = await prisma.slackConnection.findFirst({
      where: { userId }
    });

    if (!connection) {
      console.warn(`[SlackService] User ${userId} is not connected to Slack. Ignoring notification.`);
      return;
    }

    // Attempt to send a message. Since we might not have a specific channel, 
    // sending to the user's own DM (or a default channel) is standard.
    // For this assignment, we will use chat.postMessage. 
    // If channelId is null, we can try to use their team's #general or just log a warning.
    // We will attempt to send to the channelId if available, otherwise just use the user ID as channel (DM).
    const channel = connection.channelId || 'general';

    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${connection.accessToken}`
      },
      body: JSON.stringify({
        channel: channel,
        text: message
      })
    });

    const data = await response.json();
    if (!data.ok) {
      console.warn(`[SlackService] Failed to send Slack message: ${data.error}`);
    }
  } catch (error: any) {
    console.error(`[SlackService] Error sending Slack notification: ${error.message}`);
    // Gracefully do nothing / never crash the caller
  }
};
