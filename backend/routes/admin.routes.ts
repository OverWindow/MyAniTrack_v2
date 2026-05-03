import { Router, Request, Response } from 'express';
import { syncAnimePage, syncAllAnime, syncAnimeInChunks } from '../sync/anime.sync.service';
import { translateAnimeKoreanTitlesInBatches } from '../translations/anime.korean-title.service';

const router = Router();

// 한 페이지만 동기화
router.post('/admin/anime/sync/page', async (req: Request, res: Response) => {
  try {
    const page = Number(req.body.page || 1);
    const perPage = Number(req.body.perPage || 50);

    const result = await syncAnimePage(page, perPage);

    res.json({
      success: true,
      message: 'Anime page synced successfully',
      result,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// 여러 페이지 동기화
router.post('/admin/anime/sync/all', async (req: Request, res: Response) => {
  try {
    const startPage = Number(req.body.startPage || 1);
    const perPage = Number(req.body.perPage || 50);
    const maxPages = req.body.maxPages ? Number(req.body.maxPages) : undefined;

    const result = await syncAllAnime(startPage, perPage, maxPages);

    res.json({
      success: true,
      message: 'Anime sync completed',
      result,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// 10페이지 단위로 끊어서 동기화
router.post('/admin/anime/sync/chunked', async (req: Request, res: Response) => {
  try {
    const startPage = Number(req.body.startPage || 1);
    const perPage = Number(req.body.perPage || 50);
    const pagesPerChunk = Number(req.body.pagesPerChunk || 10);
    const chunkDelayMs = Number(req.body.chunkDelayMs || 10000);
    const maxChunks = req.body.maxChunks ? Number(req.body.maxChunks) : undefined;

    const result = await syncAnimeInChunks(
      startPage,
      perPage,
      pagesPerChunk,
      chunkDelayMs,
      maxChunks
    );

    res.json({
      success: true,
      message: 'Anime chunked sync completed',
      result,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/admin/anime/korean-titles/translate', async (req: Request, res: Response) => {
  try {
    const batchSize = Number(req.body.batchSize || 100);
    const maxBatches = Number(req.body.maxBatches || 1);

    const result = await translateAnimeKoreanTitlesInBatches(batchSize, maxBatches);

    res.json({
      success: true,
      message: 'Anime Korean title translation completed',
      result,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
