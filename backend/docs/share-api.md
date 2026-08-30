# Collection and analysis sharing

Share links are read-only, use the `ANYONE` audience, and are available without authentication at
`{SHARE_PUBLIC_ORIGIN}/s/{token}`. A user can keep one active link for each of `COLLECTION` and
`ANALYSIS`. Recreating a revoked or expired link rotates its public ID.

## Required production environment

```env
SHARE_TOKEN_SECRET=<at-least-32-random-characters>
SHARE_PUBLIC_ORIGIN=https://myanitrack.com
SHARE_API_ORIGIN=https://api.myanitrack.com
SHARE_OG_IMAGE_URL=https://your-public-storage.example/og/share-default-v2.png
```

Changing `SHARE_TOKEN_SECRET` invalidates all existing URLs and opaque cursors. Keep the value in a
server-side secret store and do not expose it to the frontend.

`SHARE_OG_IMAGE_URL` is optional. It must be a publicly accessible HTTP(S) image URL and lets the
social preview artwork be replaced without rebuilding the backend. Use a versioned object path when
replacing it so messenger and CDN caches do not continue serving the previous image.

## Management API

- `GET /api/me/shares`
- `PUT /api/me/shares/:resourceType` with `{ "expiresInDays": 1 | 7 | 30 | null }`
- `DELETE /api/me/shares/:resourceType`

Management endpoints require authentication. `resourceType` is `collection` or `analysis`.

## Public read API

- `GET /api/shares/:token`
- Collection: `/anime-list`, `/anime-list/series`
- Analysis: `/anime-stats`, `/viewing-dna`, `/genre-bubble`, `/yearly-scores`,
  `/format-distribution`, `/studios`, studio anime, voice-actor ranking, and voice-actor anime
- Analysis chart drill-down: `/analysis/anime-list` with at least one of `genre`, `year`, or `score`

Public data responses are `private, no-store`, do not send referrers, and omit notes, internal user
and list IDs, and internal timestamps. Invalid, revoked, missing, or suspended-owner links return
`404 SHARE_NOT_FOUND`; expired links return `410 SHARE_EXPIRED`.

## Social preview

- `GET /share-preview/:token`
- `GET /share-preview/:token/image.png`

The HTML contains Open Graph, Twitter card, canonical, and `noindex` metadata. The PNG renderer uses
Sharp with the bundled Noto Sans KR font. Invalid links receive a generic preview without user data.
