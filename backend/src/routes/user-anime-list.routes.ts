import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import {
  createMyAnimeListItem,
  deleteMyAnimeListItem,
  getMyAnimeList,
  getMyAnimeRelationController,
  getUserAnimeListController,
  updateMyAnimeListItem,
} from '../controllers/user-anime-list.controller';

const router = Router();

router.post('/me/anime-list', requireAuth, createMyAnimeListItem);
router.get('/me/anime-list', requireAuth, getMyAnimeList);
router.get('/me/anime-list/:animeId', requireAuth, getMyAnimeRelationController);
router.get('/users/:userId/anime-list', getUserAnimeListController);
router.patch('/me/anime-list/:animeId', requireAuth, updateMyAnimeListItem);
router.delete('/me/anime-list/:animeId', requireAuth, deleteMyAnimeListItem);

export default router;
