import { Router } from 'express';
import { getPlatformSummary, getPopularAnimeList } from '../controllers/platform-stats.controller';

const router = Router();

router.get('/stats/platform', getPlatformSummary);
router.get('/stats/platform/popular-anime', getPopularAnimeList);

export default router;
