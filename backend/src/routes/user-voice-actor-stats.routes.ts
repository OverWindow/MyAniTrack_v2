import { Router } from 'express';
import {
  getMyVoiceActorAnime,
  getMyVoiceActorRanking,
  getUserVoiceActorAnimeController,
  getUserVoiceActorRankingController,
} from '../controllers/user-voice-actor-stats.controller';
import { getVoiceActorDetailController } from '../controllers/voice-actor-detail.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.get('/voice-actors/:voiceActorId', getVoiceActorDetailController);
router.get('/me/voice-actors/ranking', requireAuth, getMyVoiceActorRanking);
router.get('/me/voice-actors/:voiceActorId/anime', requireAuth, getMyVoiceActorAnime);
router.get('/users/:userId/voice-actors/ranking', getUserVoiceActorRankingController);
router.get('/users/:userId/voice-actors/:voiceActorId/anime', getUserVoiceActorAnimeController);

export default router;
