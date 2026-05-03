// anilist-sample.js
// Node.js 18+ 기준 (fetch 내장)

const ANILIST_API = 'https://graphql.anilist.co';

const query = `
  query ($page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        currentPage
        hasNextPage
        perPage
      }
      media(type: ANIME, sort: POPULARITY_DESC) {
        id
        title {
          romaji
          english
          native
        }
        format
        episodes
        status
        averageScore
        season
        seasonYear
        coverImage {
          large
          medium
        }
      }
    }
  }
`;

async function fetchAnimeSample(page = 1, perPage = 10) {
  const response = await fetch(ANILIST_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      query,
      variables: { page, perPage }
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();

  if (result.errors) {
    throw new Error(`GraphQL error: ${JSON.stringify(result.errors, null, 2)}`);
  }

  return result.data.Page;
}

(async () => {
  try {
    const pageData = await fetchAnimeSample(1, 10);

    console.log('pageInfo:', pageData.pageInfo);
    console.log('anime list:');

    for (const anime of pageData.media) {
      console.log({
        id: anime.id,
        title:
          anime.title.english ||
          anime.title.romaji ||
          anime.title.native,
        format: anime.format,
        episodes: anime.episodes,
        status: anime.status,
        averageScore: anime.averageScore,
        season: anime.season,
        seasonYear: anime.seasonYear,
        image: anime.coverImage.large
      });
    }
  } catch (err) {
    console.error(err);
  }
})();