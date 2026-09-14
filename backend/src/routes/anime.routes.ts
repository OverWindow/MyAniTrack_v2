import { Router } from 'express';
import {
  getAnimeById,
  getAnimeCast,
  getAnimeIndex,
  getAnimeSeriesIndex,
  getAnimeRelationsController,
  searchAnime,
  searchAnimeWithRelationsController,
  searchAnimeWithMyCollection,
} from '../controllers/anime.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.get('/anime', getAnimeIndex);
router.get('/anime/series', getAnimeSeriesIndex);
router.get('/anime/search', searchAnime);
router.get('/anime/search-with-relations', searchAnimeWithRelationsController);
router.get('/me/anime/search', requireAuth, searchAnimeWithMyCollection);
router.get('/anime/:id/cast', getAnimeCast);
router.get('/anime/:id/relations', getAnimeRelationsController);
router.get('/anime/:id', getAnimeById);

export default router;
