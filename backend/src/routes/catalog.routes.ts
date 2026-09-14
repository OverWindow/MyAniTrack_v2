import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import {
  createMyCatalogSubmissionController,
  listMyCatalogSubmissionsController,
  searchCatalogController,
  withdrawMyCatalogSubmissionController,
} from '../controllers/catalog.controller';

const router = Router();

router.get('/catalog/search', searchCatalogController);
router.post('/me/catalog-submissions', requireAuth, createMyCatalogSubmissionController);
router.get('/me/catalog-submissions', requireAuth, listMyCatalogSubmissionsController);
router.delete('/me/catalog-submissions/:id', requireAuth, withdrawMyCatalogSubmissionController);

export default router;
