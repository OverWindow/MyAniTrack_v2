import assert from 'node:assert/strict';
import test from 'node:test';
import { getGuestSampleStudioRanking } from './guest-sample.service';

test('sample studio ranking matches the production response shape', () => {
  const response = getGuestSampleStudioRanking('count', 2);

  assert.equal(response.success, true);
  assert.equal(response.items.length, 2);
  assert.equal(response.pageInfo.sort, 'count');
  assert.equal(response.pageInfo.status, 'all');
  assert.equal(response.summary.studioCount, 6);
  assert.deepEqual(response.summary.source, {
    status: 'all',
    mainOnly: true,
  });

  const firstItem = response.items[0];
  assert.ok(firstItem);
  assert.deepEqual(Object.keys(firstItem.studio).sort(), [
    'anilistId',
    'id',
    'isAnimationStudio',
    'name',
    'siteUrl',
  ]);
  assert.equal(typeof firstItem.completedAnimeCount, 'number');
  assert.equal(typeof firstItem.totalWatchedEpisodes, 'number');
  assert.equal(typeof firstItem.totalWatchMinutes, 'number');
});

test('sample studio ranking honors each sort without changing the pre-limit summary', () => {
  const byCount = getGuestSampleStudioRanking('count', 1);
  const byScore = getGuestSampleStudioRanking('score', 1);
  const byWatchTime = getGuestSampleStudioRanking('watchTime', 1);

  assert.equal(byCount.items[0]?.studio.name, 'Kyoto Animation');
  assert.equal(byScore.items[0]?.studio.name, 'WIT Studio');
  assert.equal(byWatchTime.items[0]?.studio.name, 'Madhouse');
  assert.equal(byCount.summary.studioCount, 6);
  assert.equal(byScore.summary.studioCount, 6);
  assert.equal(byWatchTime.summary.studioCount, 6);
});
