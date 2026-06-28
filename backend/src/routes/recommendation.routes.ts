import { Router } from 'express';
import { requireAdmin, requireAuth } from '../middleware/auth.middleware';
import {
  getMyAnimeStats,
  getMyRecommendations,
  getUserStats,
  recalculateMyAnimeStats,
} from '../controllers/recommendation.controller';
import {
  getMyBadges,
  getUserBadges,
  recalculateEveryUserBadges,
  recalculateMyBadges,
} from '../controllers/badge.controller';

const router = Router();

router.get('/me/anime-stats', requireAuth, getMyAnimeStats);
router.get('/users/:userId/anime-stats', getUserStats);
router.post('/me/anime-stats/recalculate', requireAuth, recalculateMyAnimeStats);
router.get('/me/badges', requireAuth, getMyBadges);
router.get('/users/:userId/badges', getUserBadges);
router.post('/me/badges/recalculate', requireAuth, recalculateMyBadges);
router.post('/admin/badges/recalculate-all', requireAdmin, recalculateEveryUserBadges);
router.get('/me/recommendations', requireAuth, getMyRecommendations);

export default router;
