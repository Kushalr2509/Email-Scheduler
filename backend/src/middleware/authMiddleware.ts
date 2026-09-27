import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be defined in production');
}
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-default-key-for-dev';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
      };
    }
  }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  const token = req.cookies.auth_token;

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    req.user = { id: decoded.userId };
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
