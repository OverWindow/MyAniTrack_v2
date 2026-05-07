import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import {
  createFriendRequest,
  deleteFriend,
  listFriendRequests,
  listFriends,
  updateFriendRequest,
} from '../controllers/friend.controller';

const router = Router();

router.post('/friends/requests', requireAuth, createFriendRequest);
router.get('/friends/requests', requireAuth, listFriendRequests);
router.patch('/friends/requests/:requestId', requireAuth, updateFriendRequest);
router.get('/friends', requireAuth, listFriends);
router.delete('/friends/:friendUserId', requireAuth, deleteFriend);

export default router;
