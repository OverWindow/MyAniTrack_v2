import {
  findAnimeWithoutKoreanTitles,
  KoreanTitleRecord,
  saveKoreanTitles,
} from './anime.korean-title.repository';
import { translateAnimeTitlesToKorean } from './openai.translation.client';

export async function translateNextAnimeKoreanTitleBatch(batchSize = 100) {
  const sourceItems = await findAnimeWithoutKoreanTitles(batchSize);

  if (sourceItems.length === 0) {
    return {
      requestedBatchSize: batchSize,
      selectedCount: 0,
      savedCount: 0,
      remaining: false,
      items: [],
    };
  }

  const translations = await translateAnimeTitlesToKorean(sourceItems);
  const records: KoreanTitleRecord[] = translations.map((translation) => ({
    animeId: translation.animeId,
    title: translation.title,
    subtitle: translation.subtitle ?? '',
    isPrimary: translation.isPrimary ?? true,
  }));

  const savedCount = await saveKoreanTitles(records);
  const remainingItems = await findAnimeWithoutKoreanTitles(1);

  return {
    requestedBatchSize: batchSize,
    selectedCount: sourceItems.length,
    savedCount,
    remaining: remainingItems.length > 0,
    items: records,
  };
}

export async function translateAnimeKoreanTitlesInBatches(batchSize = 100, maxBatches = 1) {
  let processedBatches = 0;
  let totalSaved = 0;
  let remaining = true;
  const results = [];

  while (processedBatches < maxBatches) {
    const result = await translateNextAnimeKoreanTitleBatch(batchSize);

    processedBatches += 1;
    totalSaved += result.savedCount;
    remaining = result.remaining;
    results.push(result);

    if (!remaining || result.selectedCount === 0) {
      break;
    }
  }

  return {
    batchSize,
    maxBatches,
    processedBatches,
    totalSaved,
    remaining,
    results,
  };
}
