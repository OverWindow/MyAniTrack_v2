import { Router } from 'express';
import { requireAdmin } from '../src/middleware/auth.middleware';
import {
  syncAllAnimeController,
  syncAnimeInChunksController,
  syncAnimePageController,
  syncSeasonAnimeController,
  translateAnimeKoreanTitlesController,
  updateAnimeKoreanTitleController,
} from '../src/controllers/admin.controller';

const router = Router();

router.use('/admin', requireAdmin);

router.post('/admin/anime/sync/page', syncAnimePageController);
router.post('/admin/anime/sync/all', syncAllAnimeController);
router.post('/admin/anime/sync/chunked', syncAnimeInChunksController);
router.post('/admin/anime/sync/season', syncSeasonAnimeController);
router.post('/admin/anime/korean-titles/translate', translateAnimeKoreanTitlesController);
router.patch('/admin/anime/:animeId/korean-title', updateAnimeKoreanTitleController);

export default router;
