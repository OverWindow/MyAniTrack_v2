import { Router } from 'express';
import {
  getGuestSampleAnimeListController,
  getGuestSampleAnimeStatsController,
  getGuestSampleFormatStatsController,
  getGuestSampleGenreBubbleChartController,
  getGuestSampleOverviewController,
  getGuestSampleStudioRankingController,
  getGuestSampleYearlyScoreStatsController,
} from '../controllers/guest-sample.controller';

const router = Router();

router.get('/sample/overview', getGuestSampleOverviewController);
router.get('/sample/anime-list', getGuestSampleAnimeListController);
router.get('/sample/anime-stats', getGuestSampleAnimeStatsController);
router.get('/sample/anime-stats/genre-bubble', getGuestSampleGenreBubbleChartController);
router.get('/sample/anime-stats/yearly-scores', getGuestSampleYearlyScoreStatsController);
router.get('/sample/anime-stats/format-distribution', getGuestSampleFormatStatsController);
router.get('/sample/anime-stats/studios', getGuestSampleStudioRankingController);

export default router;
