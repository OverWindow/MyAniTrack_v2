import { Router } from 'express';
import { requireAdmin } from '../src/middleware/auth.middleware';
import {
  getAdminUserController,
  getAdminUsersController,
  rebuildAnimeSeriesController,
  syncAllAnimeController,
  syncAllAnimeIntegratedController,
  syncAnimeCastBatchController,
  syncAnimeCastController,
  syncAnimeCastInChunksController,
  syncAnimeInChunksController,
  syncAnimePageController,
  syncAnimeRelationsController,
  syncMissingAnimeStudiosController,
  syncSeasonAnimeController,
  getAnimeCastSyncStateController,
  translateAnimeKoreanTitlesController,
  updateAnimeKoreanTitleController,
} from '../src/controllers/admin.controller';
import {
  listProfileReportsController,
  resolveProfileReportController,
  setAnimeVisibilityController,
} from '../src/controllers/content-moderation.controller';
import { updateMaintenanceSettingsController } from '../src/controllers/maintenance.controller';

const router = Router();

router.use('/admin', requireAdmin);

router.get('/admin/users', getAdminUsersController);
router.get('/admin/users/:userId', getAdminUserController);
router.patch('/admin/maintenance', updateMaintenanceSettingsController);
router.get('/admin/profile-reports', listProfileReportsController);
router.patch('/admin/profile-reports/:reportId', resolveProfileReportController);
router.patch('/admin/anime/:animeId/visibility', setAnimeVisibilityController);
router.post('/admin/anime/sync/full', requireAdmin, syncAllAnimeIntegratedController);
router.post('/admin/anime/sync/relations', requireAdmin, syncAnimeRelationsController);
router.post('/admin/anime/series/rebuild', requireAdmin, rebuildAnimeSeriesController);
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
