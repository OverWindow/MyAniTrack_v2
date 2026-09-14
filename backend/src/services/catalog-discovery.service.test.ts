import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildChatKhuRequest,
  buildChatKhuSearchRequest,
  calculateCatalogConfidence,
  collectChatKhuSearchSources,
  CATALOG_DISCOVERY_MODEL,
  CATALOG_DISCOVERY_SEARCH_MODEL,
  getDueCatalogDiscoverySchedules,
  getCatalogSeasonMismatchReason,
  isSeasonOverviewTitle,
  normalizeNamuWikiUrl,
  parseJsonOutput,
  resolveChatKhuSearchSources,
} from './catalog-discovery.service';

test('ChatKHU Luna extraction request fixes model, reasoning, storage, and strict schema without web search', () => {
  const schema = { type: 'object', additionalProperties: false, properties: {}, required: [] };
  const request = buildChatKhuRequest('test', 'catalog_test', schema);

  assert.equal(request.model, CATALOG_DISCOVERY_MODEL);
  assert.equal(request.model, 'gpt-5.6-luna');
  assert.deepEqual(request.reasoning, { effort: 'medium' });
  assert.equal(request.store, false);
  assert.equal('include' in request, false);
  assert.equal('tools' in request, false);
  assert.equal(request.text.format.strict, true);
  assert.equal(request.text.format.schema, schema);
});

test('ChatKHU search request enables Gemini Flash-Lite web search and keeps a strict schema', () => {
  const schema = { type: 'object', additionalProperties: false, properties: {}, required: [] };
  const request = buildChatKhuSearchRequest('test', 'catalog_search_test', schema);

  assert.equal(request.model, CATALOG_DISCOVERY_SEARCH_MODEL);
  assert.equal(request.model, 'gemini-3.5-flash-lite');
  assert.deepEqual(request.web_search_options, { search_context_size: 'medium' });
  assert.equal('search_domain_filter' in request, false);
  assert.match(request.messages[0].content, /Return exactly one JSON object/);
  assert.match(request.messages[0].content, /additionalProperties/);
  assert.equal(request.reasoning_effort, 'low');
  assert.equal(request.response_format.json_schema.strict, true);
  assert.equal(request.response_format.json_schema.schema, schema);
});

test('structured search output parser tolerates a short prose prefix', () => {
  assert.deepEqual(parseJsonOutput('Search complete.\n{"candidates":[]}'), { candidates: [] });
});

test('season overview pages cannot become anime candidates', () => {
  assert.equal(isSeasonOverviewTitle('애니메이션/2026년 7월'), true);
  assert.equal(isSeasonOverviewTitle('2026년 3분기 일본 애니메이션'), true);
  assert.equal(isSeasonOverviewTitle('장송의 프리렌'), false);
});

test('catalog discovery skips candidates that conflict with the requested season', () => {
  assert.match(getCatalogSeasonMismatchReason(
    { seasonYear: 2026, season: 'SUMMER' },
    { payload: { seasonYear: 2025, season: 'SPRING' }, conflicts: [] },
  ) ?? '', /수집 연도 2025/);
  assert.equal(getCatalogSeasonMismatchReason(
    { seasonYear: 2026, season: 'SUMMER' },
    { payload: { seasonYear: 2026, season: 'SUMMER' }, conflicts: ['airing: 2025년 방영으로 대상 분기와 불일치'] },
  ), 'airing: 2025년 방영으로 대상 분기와 불일치');
  assert.equal(getCatalogSeasonMismatchReason(
    { seasonYear: 2026, season: 'SUMMER' },
    { payload: { seasonYear: 2026, season: 'SUMMER' }, conflicts: [] },
  ), null);
});

test('Gemini model-declared sources are marked unverified when the gateway omits citation metadata', () => {
  const sourceUrl = 'https://namu.wiki/w/example';
  assert.deepEqual(resolveChatKhuSearchSources({ choices: [] }, { sourceUrl }), {
    sources: [{ url: sourceUrl, title: null }],
    gatewayVerified: false,
  });
  assert.deepEqual(resolveChatKhuSearchSources({ search_results: [{ url: sourceUrl, title: 'Example' }] }, { sourceUrl }), {
    sources: [{ url: sourceUrl, title: 'Example' }],
    gatewayVerified: true,
  });
});

test('Gemini grounding metadata verifies an exact namu.wiki URL returned in structured output', () => {
  const sourceUrl = 'https://namu.wiki/w/example';
  const response = {
    choices: [{
      message: {
        extra_content: {
          google: {
            grounding_metadata: {
              groundingChunks: [{ web: { uri: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/example', title: 'namu.wiki' } }],
            },
          },
        },
      },
    }],
  };
  assert.deepEqual(resolveChatKhuSearchSources(response, { sourceUrl }), {
    sources: [{ url: sourceUrl, title: null }],
    gatewayVerified: true,
  });
});

test('search sources accept only the exact Korean namu.wiki host and canonicalize tracking URLs', () => {
  const canonical = 'https://namu.wiki/w/example';
  const sources = collectChatKhuSearchSources({
    citations: [`${canonical}?uuid=tracking`, 'https://en.namu.wiki/w/example', 'https://example.com/page'],
    search_results: [
      { url: `${canonical}#section`, title: 'Example' },
      { url: 'https://ja.namu.wiki/w/example', title: 'Japanese mirror' },
    ],
  });

  assert.deepEqual(sources, [{ url: canonical, title: 'Example' }]);
  assert.equal(normalizeNamuWikiUrl(`${canonical}?uuid=tracking#section`), canonical);
  assert.equal(normalizeNamuWikiUrl('https://en.namu.wiki/w/example'), null);
});

test('confidence only credits fields connected to actual namu.wiki search sources', () => {
  const source = 'https://namu.wiki/w/example';
  const detail = {
    displayName: 'Example', sourceUrl: source, description: 'Summary', conflicts: ['airing conflict'],
    payload: {
      titleRomaji: 'Example', titleEnglish: 'Example', titleNative: '예시', titleKorean: '예시',
      description: 'Summary', format: 'TV', source: 'ORIGINAL',
      episodes: 12, duration: 24, season: 'SPRING', seasonYear: 2026, status: 'FINISHED',
      studios: [{}], cast: [{}], relations: [{}],
    },
    sectionEvidence: {
      basic: [source], airing: [source], studios: [source], characters: [source],
      voiceActors: [source], relations: ['https://example.com/not-a-search-source'],
    },
  };
  const confidence = calculateCatalogConfidence(detail, [{ url: source }]);

  assert.equal(confidence.basic, 1);
  assert.equal(confidence.airing, 0.5);
  assert.equal(confidence.studios, 1);
  assert.equal(confidence.characters, 1);
  assert.equal(confidence.voiceActors, 1);
  assert.equal(confidence.relations, 0);
  assert.equal(confidence.overall, 0.775);
});

test('quarterly KST schedule becomes due at exactly 03:00', () => {
  const before = getDueCatalogDiscoverySchedules(new Date('2025-12-31T17:59:59.999Z'));
  const at = getDueCatalogDiscoverySchedules(new Date('2025-12-31T18:00:00.000Z'));

  assert.equal(before.some((item) => item.scheduleKey === '2026-WINTER-INITIAL'), false);
  assert.equal(at.some((item) => item.scheduleKey === '2026-WINTER-INITIAL'), true);
});

test('restart catch-up queues only the latest scheduled discovery slot', () => {
  assert.deepEqual(getDueCatalogDiscoverySchedules(new Date('2026-09-12T11:00:00.000Z')), [{
    year: 2026,
    season: 'SUMMER',
    phase: 'REFRESH',
    scheduleKey: '2026-SUMMER-REFRESH',
  }]);
});
