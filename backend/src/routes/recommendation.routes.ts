import { Router } from 'express';
import { requireAdmin, requireAuth } from '../middleware/auth.middleware';
import {
  getMyGenreBubbleChart,
  getMyAnimeStats,
  getMyRecommendations,
  getUserGenreBubbleChartController,
  getUserStats,
  recalculateMyAnimeStats,
} from '../controllers/recommendation.controller';
import {
  getMyBadges,
  getUserBadges,
  recalculateEveryUserBadges,
  recalculateMyBadges,
} from '../controllers/badge.controller';
import {
  getMyStudioAnime,
  getMyStudioRanking,
  getUserStudioAnimeController,
  getUserStudioRankingController,
} from '../controllers/user-studio-stats.controller';
import {
  getMyYearlyScoreStats,
  getUserYearlyScoreStatsController,
} from '../controllers/user-yearly-score-stats.controller';

const router = Router();

router.get('/me/anime-stats', requireAuth, getMyAnimeStats);
router.get('/me/anime-stats/genre-bubble', requireAuth, getMyGenreBubbleChart);
router.get('/me/anime-stats/yearly-scores', requireAuth, getMyYearlyScoreStats);
router.get('/me/anime-stats/studios', requireAuth, getMyStudioRanking);
router.get('/me/anime-stats/studios/:studioId/anime', requireAuth, getMyStudioAnime);
router.get('/users/:userId/anime-stats', getUserStats);
router.get('/users/:userId/anime-stats/genre-bubble', getUserGenreBubbleChartController);
router.get('/users/:userId/anime-stats/yearly-scores', getUserYearlyScoreStatsController);
router.get('/users/:userId/anime-stats/studios', getUserStudioRankingController);
router.get('/users/:userId/anime-stats/studios/:studioId/anime', getUserStudioAnimeController);
router.post('/me/anime-stats/recalculate', requireAuth, recalculateMyAnimeStats);
router.get('/me/badges', requireAuth, getMyBadges);
router.get('/users/:userId/badges', getUserBadges);
router.post('/me/badges/recalculate', requireAuth, recalculateMyBadges);
router.post('/admin/badges/recalculate-all', requireAdmin, recalculateEveryUserBadges);
router.get('/me/recommendations', requireAuth, getMyRecommendations);

export default router;
