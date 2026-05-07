import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import {
  getMyAnimeStats,
  getMyRecommendations,
  getUserStats,
  recalculateMyAnimeStats,
} from '../controllers/recommendation.controller';

const router = Router();

router.get('/me/anime-stats', requireAuth, getMyAnimeStats);
router.get('/users/:userId/anime-stats', getUserStats);
router.post('/me/anime-stats/recalculate', requireAuth, recalculateMyAnimeStats);
router.get('/me/recommendations', requireAuth, getMyRecommendations);

export default router;
