import { Router } from 'express';
import { search, triggerBulkIndex } from '../controllers/searchController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.get('/', requireAuth, search);
router.post('/bulk-index', requireAuth, triggerBulkIndex); // Optional, for admin/dev

export default router;
