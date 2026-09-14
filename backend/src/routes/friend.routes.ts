import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import {
  createFriendRequest,
  deleteFriend,
  listFriendRequests,
  listFriends,
  searchUsersController,
  updateFriendRequest,
} from '../controllers/friend.controller';

const router = Router();

router.get('/users/search', requireAuth, searchUsersController);
router.post('/friends/requests', requireAuth, createFriendRequest);
router.get('/friends/requests', requireAuth, listFriendRequests);
router.patch('/friends/requests/:requestId', requireAuth, updateFriendRequest);
router.get('/friends', requireAuth, listFriends);
router.delete('/friends/:friendUserId', requireAuth, deleteFriend);

export default router;
