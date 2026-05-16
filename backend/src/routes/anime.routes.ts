import { Router } from 'express';
import { getAnimeById, getAnimeIndex, searchAnime, searchAnimeWithMyCollection } from '../controllers/anime.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.get('/anime', getAnimeIndex);
router.get('/anime/search', searchAnime);
router.get('/me/anime/search', requireAuth, searchAnimeWithMyCollection);
router.get('/anime/:id', getAnimeById);

export default router;
