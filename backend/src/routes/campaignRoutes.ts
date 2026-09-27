import { Router } from 'express';
import { createCampaign, getScheduledCampaigns, getSentCampaigns, getCampaignById } from '../controllers/campaignController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.post('/', requireAuth, createCampaign);
router.get('/scheduled', requireAuth, getScheduledCampaigns);
router.get('/sent', requireAuth, getSentCampaigns);
router.get('/:id', requireAuth, getCampaignById);

export default router;
