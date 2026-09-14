import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import {
  blockUserController,
  listBlockedUsersController,
  reportProfileController,
  unblockUserController,
} from '../controllers/content-moderation.controller';

const router = Router();
router.post('/users/:userId/profile-reports', requireAuth, reportProfileController);
router.post('/users/:userId/block', requireAuth, blockUserController);
router.delete('/users/:userId/block', requireAuth, unblockUserController);
router.get('/me/blocks', requireAuth, listBlockedUsersController);
export default router;
