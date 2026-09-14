import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { optionalAuth, requireVisibleUser } from '../middleware/content-visibility.middleware';
import {
  createMyAnimeListItem,
  deleteMyAnimeListItem,
  getMyAnimeList,
  getMyAnimeSeriesCollection,
  getMyAnimeRelationController,
  getUserAnimeListController,
  getUserAnimeSeriesCollection,
  updateMyAnimeListItem,
} from '../controllers/user-anime-list.controller';
import {
  estimateSmartRatingController,
  getSmartRatingCandidatesController,
} from '../controllers/smart-rating.controller';

const router = Router();

router.post('/me/anime-list', requireAuth, createMyAnimeListItem);
router.get('/me/anime-list', requireAuth, getMyAnimeList);
router.get('/me/anime-list/series', requireAuth, getMyAnimeSeriesCollection);
router.get('/me/anime-list/smart-rating/candidates', requireAuth, getSmartRatingCandidatesController);
router.post('/me/anime-list/smart-rating/estimate', requireAuth, estimateSmartRatingController);
router.get('/me/anime-list/:animeId', requireAuth, getMyAnimeRelationController);
router.get('/users/:userId/anime-list/series', optionalAuth, requireVisibleUser, getUserAnimeSeriesCollection);
router.get('/users/:userId/anime-list', optionalAuth, requireVisibleUser, getUserAnimeListController);
router.patch('/me/anime-list/:animeId', requireAuth, updateMyAnimeListItem);
router.delete('/me/anime-list/:animeId', requireAuth, deleteMyAnimeListItem);

export default router;
