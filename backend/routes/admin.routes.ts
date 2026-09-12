import { Router } from 'express';
import multer from 'multer';
import { requireAdmin } from '../src/middleware/auth.middleware';
import { getAdminUserController, getAdminUsersController, rebuildAnimeSeriesController, updateAnimeKoreanTitleController } from '../src/controllers/admin.controller';
import {
  approveAdminCatalogSubmissionController, createAdminCatalogEntityController, getAdminCatalogSubmissionController,
  getAdminCatalogEntityController, getAdminCatalogTaxonomyController,
  listAdminCatalogSubmissionsController, rejectAdminCatalogSubmissionController, updateAdminCatalogEntityController,
  searchAdminCatalogController, updateAdminCatalogSubmissionController, uploadAdminCatalogImageController,
} from '../src/controllers/catalog.controller';
import {
  cancelCatalogDiscoveryRunController, createCatalogDiscoveryRunController, getCatalogDiscoveryRunController,
  listCatalogDiscoveryRunsController, retryCatalogDiscoveryRunController,
} from '../src/controllers/catalog-discovery.controller';
import { listProfileReportsController, resolveProfileReportController, setAnimeVisibilityController } from '../src/controllers/content-moderation.controller';
import { updateMaintenanceSettingsController } from '../src/controllers/maintenance.controller';
import { getAdminOverviewController } from '../src/controllers/admin-overview.controller';

const router = Router();
const imageUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });

router.use('/admin', requireAdmin);
router.get('/admin/overview', getAdminOverviewController);
router.get('/admin/users', getAdminUsersController);
router.get('/admin/users/:userId', getAdminUserController);
router.patch('/admin/maintenance', updateMaintenanceSettingsController);
router.get('/admin/profile-reports', listProfileReportsController);
router.patch('/admin/profile-reports/:reportId', resolveProfileReportController);
router.patch('/admin/anime/:animeId/visibility', setAnimeVisibilityController);
router.post('/admin/anime/series/rebuild', rebuildAnimeSeriesController);
router.patch('/admin/anime/:animeId/korean-title', updateAnimeKoreanTitleController);
router.get('/admin/catalog/taxonomy', getAdminCatalogTaxonomyController);
router.get('/admin/catalog/entities/search', searchAdminCatalogController);
router.get('/admin/catalog/entities/:type/:id', getAdminCatalogEntityController);
router.post('/admin/catalog/entities/:type', createAdminCatalogEntityController);
router.patch('/admin/catalog/entities/:type/:id', updateAdminCatalogEntityController);
router.post('/admin/catalog/entities/:type/:id/images', imageUpload.single('image'), uploadAdminCatalogImageController);
router.get('/admin/catalog/submissions', listAdminCatalogSubmissionsController);
router.get('/admin/catalog/submissions/:id', getAdminCatalogSubmissionController);
router.patch('/admin/catalog/submissions/:id', updateAdminCatalogSubmissionController);
router.post('/admin/catalog/submissions/:id/approve', approveAdminCatalogSubmissionController);
router.post('/admin/catalog/submissions/:id/reject', rejectAdminCatalogSubmissionController);
router.get('/admin/catalog/discovery-runs', listCatalogDiscoveryRunsController);
router.post('/admin/catalog/discovery-runs', createCatalogDiscoveryRunController);
router.get('/admin/catalog/discovery-runs/:id', getCatalogDiscoveryRunController);
router.post('/admin/catalog/discovery-runs/:id/cancel', cancelCatalogDiscoveryRunController);
router.post('/admin/catalog/discovery-runs/:id/retry', retryCatalogDiscoveryRunController);

export default router;
