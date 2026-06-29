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

export const ANILIST_SEASON_ANIME_PAGE_QUERY = `
  query ($page: Int, $perPage: Int, $season: MediaSeason, $seasonYear: Int) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        currentPage
        hasNextPage
        lastPage
        perPage
      }
      media(
        type: ANIME,
        season: $season,
        seasonYear: $seasonYear,
        sort: POPULARITY_DESC
      ) {
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

export const ANILIST_ANIME_CAST_QUERY = `
  query ($anilistId: Int, $page: Int, $perPage: Int, $language: StaffLanguage) {
    Media(id: $anilistId, type: ANIME) {
      id
      updatedAt
      characters(page: $page, perPage: $perPage, sort: [ROLE, RELEVANCE, ID]) {
        pageInfo {
          currentPage
          hasNextPage
          lastPage
          perPage
        }
        edges {
          role
          name
          node {
            id
            name {
              full
              native
              userPreferred
            }
            image {
              large
              medium
            }
            gender
            age
            description(asHtml: false)
            siteUrl
            updatedAt
          }
          voiceActors(language: $language, sort: [RELEVANCE, ID]) {
            id
            name {
              full
              native
              userPreferred
            }
            languageV2
            image {
              large
              medium
            }
            description(asHtml: false)
            siteUrl
            updatedAt
          }
        }
      }
    }
  }
`;
