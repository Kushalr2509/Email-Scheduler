import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendEmail(
  to: string, 
  subject: string, 
  text: string, 
  from?: string, 
  attachments?: any[]
): Promise<string> {
  try {
    const info = await transporter.sendMail({
      from: from || '"ReachInbox Email Scheduler" <no-reply@reachinbox.com>',
      to,
      subject,
      text,
      attachments: attachments ? attachments.map(att => ({
        filename: att.filename,
        content: att.content,
        encoding: 'base64'
      })) : undefined
    });
    
    logger.info(`Message sent to ${to}`, { messageId: info.messageId });
    return info.messageId;
  } catch (error) {
    logger.error(`Failed to send email to ${to}`, error);
    throw error;
  }
}
