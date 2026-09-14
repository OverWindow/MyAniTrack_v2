# Catalog ownership API

MyAniTrack owns its public anime catalog. External URLs are evidence for review and are never public catalog identifiers.

## Public and user APIs

- `GET /api/catalog/search?type=ANIME|CHARACTER|VOICE_ACTOR|STUDIO&q=...&limit=20`
- `POST /api/me/catalog-submissions`
- `GET /api/me/catalog-submissions`
- `DELETE /api/me/catalog-submissions/:id`

A user submission requires `entityType`, `displayName`, an HTTPS `sourceUrl`, and `description`. `kind` defaults to `CREATE_ENTITY`; `UPDATE_ENTITY` and `LINK_TO_ANIME` also require `targetEntityId`. Submissions remain private until an administrator approves the complete graph.

## Administrator APIs

- `GET /admin/catalog/taxonomy`
- `POST /admin/catalog/entities/:type`
- `GET /admin/catalog/entities/search?type=...&q=...&limit=...`
- `GET /admin/catalog/entities/:type/:id`
- `PATCH /admin/catalog/entities/:type/:id`
- `POST /admin/catalog/entities/:type/:id/images` (multipart field `image`, plus `variant`)
- `GET /admin/catalog/submissions`
- `GET /admin/catalog/submissions/:id`
- `PATCH /admin/catalog/submissions/:id`
- `POST /admin/catalog/submissions/:id/approve`
- `POST /admin/catalog/submissions/:id/reject`
- `GET /admin/catalog/discovery-runs`
- `GET /admin/catalog/discovery-runs/:id`
- `POST /admin/catalog/discovery-runs`
- `POST /admin/catalog/discovery-runs/:id/cancel`
- `POST /admin/catalog/discovery-runs/:id/retry`

Approval locks the request, checks duplicates and optimistic versions, and applies the entity plus all links in one transaction. New anime remain hidden until an administrator uploads a cover and explicitly sets `appVisible` to `true`.

The taxonomy response contains `genres` and `tags`, each ordered by descending usage count and then ascending stored name. Anime writes accept only taxonomy names already present in these lists; clearing a selection uses an empty array. The entity detail endpoint returns the complete edit payload and current image URLs for anime, characters, voice actors, and studios, including an anime's titles, airing fields, genres, tags, synonyms, studio links, cast/voice-actor links, and relations.

## AI discovery contract

Set `CHATKHU_API_KEY` to the ChatKHU bearer credential. The optional endpoint overrides are `CHATKHU_CHAT_COMPLETIONS_URL` (default `https://factchat-cloud.mindlogic.ai/v1/gateway/chat/completions/`) and `CHATKHU_RESPONSES_URL` (default `https://factchat-cloud.mindlogic.ai/v1/gateway/responses/`).

Discovery is a two-stage pipeline. `gemini-3.5-flash-lite` searches through Chat Completions with `web_search_options`; ChatKHU returns Gemini grounding metadata in `message.extra_content.google.grounding_metadata`. ChatKHU does not support a `search_domain_filter` request field for Gemini, so the request instructs Gemini to use only `namu.wiki` and the server rejects every structured source URL whose hostname is not exactly `namu.wiki`. A model-declared URL without matching Gemini grounding metadata receives an administrator warning and its confidence is capped at `0.5`. The source-linked research packet is then passed to `gpt-5.6-luna` through the Responses API with `reasoning.effort=medium`, `store=false`, and strict JSON Schema. Luna does not perform web search in this gateway configuration, and the worker does not fall back to a direct crawler.

Scheduled runs are due at 03:00 KST on January, February, April, May, July, August, October, and November 1. Startup catch-up considers only the most recent scheduled slot. If that run failed before producing candidates, it is automatically requeued at startup up to three times when the ChatKHU configuration is valid. A manual retry clears that recovery count and refreshes the stored model names to the current fixed `gemini-3.5-flash-lite` → `gpt-5.6-luna` configuration. Database schedule keys provide deduplication, while a MySQL advisory lock permits only one active worker.

AI confidence is private review metadata. Section weights are basic 0.20, airing 0.15, studios 0.10, characters 0.20, voice actors 0.20, and relations 0.15. A section without a returned search source scores zero; a conflicting section is capped at 0.5.
