import { Router } from 'express';
import { requireAdmin, requireAuth } from '../middleware/auth.middleware';
import { optionalAuth, requireVisibleUser } from '../middleware/content-visibility.middleware';
import {
  getMyGenreBubbleChart,
  getMyAnimeStats,
  getMyRecommendations,
  getMyViewingDna,
  getUserGenreBubbleChartController,
  getUserStats,
  getUserViewingDnaController,
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
import {
  getMyFormatStats,
  getUserFormatStatsController,
} from '../controllers/user-format-stats.controller';

const router = Router();

router.get('/me/anime-stats', requireAuth, getMyAnimeStats);
router.get('/me/anime-stats/viewing-dna', requireAuth, getMyViewingDna);
router.get('/me/anime-stats/genre-bubble', requireAuth, getMyGenreBubbleChart);
router.get('/me/anime-stats/yearly-scores', requireAuth, getMyYearlyScoreStats);
router.get('/me/anime-stats/format-distribution', requireAuth, getMyFormatStats);
router.get('/me/anime-stats/studios', requireAuth, getMyStudioRanking);
router.get('/me/anime-stats/studios/:studioId/anime', requireAuth, getMyStudioAnime);
router.get('/users/:userId/anime-stats', optionalAuth, requireVisibleUser, getUserStats);
router.get('/users/:userId/anime-stats/viewing-dna', optionalAuth, requireVisibleUser, getUserViewingDnaController);
router.get('/users/:userId/anime-stats/genre-bubble', optionalAuth, requireVisibleUser, getUserGenreBubbleChartController);
router.get('/users/:userId/anime-stats/yearly-scores', optionalAuth, requireVisibleUser, getUserYearlyScoreStatsController);
router.get('/users/:userId/anime-stats/format-distribution', optionalAuth, requireVisibleUser, getUserFormatStatsController);
router.get('/users/:userId/anime-stats/studios', optionalAuth, requireVisibleUser, getUserStudioRankingController);
router.get('/users/:userId/anime-stats/studios/:studioId/anime', optionalAuth, requireVisibleUser, getUserStudioAnimeController);
router.post('/me/anime-stats/recalculate', requireAuth, recalculateMyAnimeStats);
router.get('/me/badges', requireAuth, getMyBadges);
router.get('/users/:userId/badges', optionalAuth, requireVisibleUser, getUserBadges);
router.post('/me/badges/recalculate', requireAuth, recalculateMyBadges);
router.post('/admin/badges/recalculate-all', requireAdmin, recalculateEveryUserBadges);
router.get('/me/recommendations', requireAuth, getMyRecommendations);

export default router;
