import { Router } from 'express';
import { googleLogin, googleCallback, logout, getMe } from '../controllers/authController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.get('/google', googleLogin);
router.get('/google/callback', googleCallback);
router.post('/logout', requireAuth, logout);
router.get('/me', requireAuth, getMe);

export default router;
