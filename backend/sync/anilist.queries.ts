export const ANILIST_ANIME_PAGE_QUERY = `
  query ($page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        currentPage
        hasNextPage
        lastPage
        perPage
      }
      media(type: ANIME, sort: ID) {
        id
        title {
          romaji
          english
          native
          userPreferred
        }
        description(asHtml: false)
        episodes
        duration
        season
        seasonYear
        format
        status
        source
        countryOfOrigin
        isAdult
        genres
        averageScore
        meanScore
        popularity
        favourites
        coverImage {
          large
          extraLarge
        }
        tags {
          name
          rank
          isMediaSpoiler
        }
        synonyms
        bannerImage
        siteUrl
        updatedAt
      }
    }
  }
`;