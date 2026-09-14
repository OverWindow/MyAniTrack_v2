# Backend API overview

The public catalog uses internal numeric entity IDs and community-derived metrics:

- `communityAverageScore`: average user score from 0 to 10, or `null`
- `ratingCount`: number of user ratings
- `collectionCount`: number of user collections containing the anime
- `officialSiteUrl`: optional official homepage
- relations use `targetAnimeId`

Catalog creation, review, discovery, and administrator interfaces are documented in [catalog-api.md](./catalog-api.md). Authentication, sharing, viewing analysis, recommendations, moderation, and maintenance routes retain their existing controller-defined contracts.

The administrator console loads its operational dashboard from the protected `GET /admin/overview` endpoint. Public platform statistics remain available from `/api/stats/platform` for existing public consumers.

Review evidence and archived legacy source references are administrator-only and are never returned by public anime, collection, statistics, recommendation, or sample DTOs.
