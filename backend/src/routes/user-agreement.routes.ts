import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { getMyAgreements, updateMyAgreements } from '../controllers/user-agreement.controller';

const router = Router();

router.get('/me/agreements', requireAuth, getMyAgreements);
router.patch('/me/agreements', requireAuth, updateMyAgreements);

export default router;
