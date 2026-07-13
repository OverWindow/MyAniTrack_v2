import { Router } from 'express';
import { requireAdmin } from '../src/middleware/auth.middleware';
import {
  getAdminUserController,
  getAdminUsersController,
  syncAllAnimeController,
  syncAnimeCastBatchController,
  syncAnimeCastController,
  syncAnimeCastInChunksController,
  syncAnimeInChunksController,
  syncAnimePageController,
  syncMissingAnimeStudiosController,
  syncSeasonAnimeController,
  getAnimeCastSyncStateController,
  translateAnimeKoreanTitlesController,
  updateAnimeKoreanTitleController,
} from '../src/controllers/admin.controller';

const router = Router();

router.use('/admin', requireAdmin);

router.get('/admin/users', getAdminUsersController);
router.get('/admin/users/:userId', getAdminUserController);
router.post('/admin/anime/sync/page', requireAdmin, syncAnimePageController);
router.post('/admin/anime/sync/all', requireAdmin, syncAllAnimeController);
router.post('/admin/anime/sync/chunked', requireAdmin, syncAnimeInChunksController);
router.post('/admin/anime/sync/season', requireAdmin, syncSeasonAnimeController);
router.post('/admin/anime/sync/studios/missing', requireAdmin, syncMissingAnimeStudiosController);
router.post('/admin/anime/sync/cast/batch', requireAdmin, syncAnimeCastBatchController);
router.post('/admin/anime/sync/cast/chunked', requireAdmin, syncAnimeCastInChunksController);
router.post('/admin/anime/:animeId/sync/cast', requireAdmin, syncAnimeCastController);
router.get('/admin/anime/:animeId/sync/cast', requireAdmin, getAnimeCastSyncStateController);
router.post('/admin/anime/korean-titles/translate', requireAdmin, translateAnimeKoreanTitlesController);
router.patch('/admin/anime/:animeId/korean-title', requireAdmin, updateAnimeKoreanTitleController);

export default router;
