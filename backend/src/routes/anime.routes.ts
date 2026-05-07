import { Router } from 'express';
import { getAnimeById, getAnimeIndex, searchAnime } from '../controllers/anime.controller';

const router = Router();

router.get('/anime', getAnimeIndex);
router.get('/anime/search', searchAnime);
router.get('/anime/:id', getAnimeById);

export default router;
