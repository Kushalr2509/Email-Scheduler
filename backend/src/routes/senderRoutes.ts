import { Router } from 'express';
import { getSenders, createSender } from '../controllers/senderController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.get('/', requireAuth, getSenders);
router.post('/', requireAuth, createSender);

export default router;
