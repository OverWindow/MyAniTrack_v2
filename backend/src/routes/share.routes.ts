import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { optionalAuth } from '../middleware/content-visibility.middleware';
import {
  getShareDescriptorController,
  getSharedAnalysisAnimeListController,
  getSharedAnimeStatsController,
  getSharedCollectionController,
  getSharedFormatDistributionController,
  getSharedGenreBubbleController,
  getSharedSeriesController,
  getSharedStudioAnimeController,
  getSharedStudioRankingController,
  getSharedViewingDnaController,
  getSharedVoiceActorAnimeController,
  getSharedVoiceActorRankingController,
  getSharedYearlyScoresController,
  listMySharesController,
  putMyShareController,
  revokeMyShareController,
} from '../controllers/share.controller';

const router = Router();

router.get('/me/shares', requireAuth, listMySharesController);
router.put('/me/shares/:resourceType', requireAuth, putMyShareController);
router.delete('/me/shares/:resourceType', requireAuth, revokeMyShareController);
router.get('/shares/:token', optionalAuth, getShareDescriptorController);
router.get('/shares/:token/anime-list', optionalAuth, getSharedCollectionController);
router.get('/shares/:token/anime-list/series', optionalAuth, getSharedSeriesController);
router.get('/shares/:token/analysis/anime-list', optionalAuth, getSharedAnalysisAnimeListController);
router.get('/shares/:token/anime-stats', optionalAuth, getSharedAnimeStatsController);
router.get('/shares/:token/viewing-dna', optionalAuth, getSharedViewingDnaController);
router.get('/shares/:token/genre-bubble', optionalAuth, getSharedGenreBubbleController);
router.get('/shares/:token/yearly-scores', optionalAuth, getSharedYearlyScoresController);
router.get('/shares/:token/format-distribution', optionalAuth, getSharedFormatDistributionController);
router.get('/shares/:token/studios', optionalAuth, getSharedStudioRankingController);
router.get('/shares/:token/studios/:studioId/anime', optionalAuth, getSharedStudioAnimeController);
router.get('/shares/:token/voice-actors/ranking', optionalAuth, getSharedVoiceActorRankingController);
router.get('/shares/:token/voice-actors/:voiceActorId/anime', optionalAuth, getSharedVoiceActorAnimeController);

export default router;
