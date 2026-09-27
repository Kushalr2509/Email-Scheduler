import { Router } from 'express';
import { getSlackStatus, connectSlack, slackCallback, disconnectSlack } from '../controllers/slackController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.get('/status', requireAuth, getSlackStatus);
router.get('/connect', requireAuth, connectSlack);
router.get('/callback', slackCallback);
router.post('/disconnect', requireAuth, disconnectSlack);

export default router;
