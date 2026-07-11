# MyAniTrack Mobile

Flutter client for MyAniTrack, an app for recording Japanese anime watch history and analyzing the collected anime library.

## Current Scope

- Warm ivory/amber visual system based on `MYANITRACK_FLUTTER_DESIGN_GUIDE.md`
- Guest sample mode UI with clear teal sample badges
- Bottom-tab app shell: Home, Collection, Analysis, Profile
- Home sample overview, sample collection, platform stats, and popular anime panels
- Collection list with search, filter, sort, pagination, add, edit, and delete flows
- Analysis panels for overview, genres, formats, yearly scores, studios, and voice actors
- Profile flows for Google OAuth, backend account linking, agreements, profile editing, sign out, and account deletion
- Auth profile card for `GET /auth/me` backend user id, role, and email verification state
- Backend logout and logout-all calls paired with Supabase sign-out
- 401/403 protected API guidance with direct agreement flow entry when required
- Public profile lookup screen for user profile, public collection, stats, badges, and voice actor ranking
- API client/repository layer based on `flutter-app-api-handoff.md`
- Supabase token injection path for authenticated backend calls

## API Coverage

The app is wired for these handoff endpoints:

- `GET /sample/overview`
- `GET /sample/anime-list`
- `GET /stats/platform`
- `GET /stats/platform/popular-anime`
- `POST /auth/supabase`
- `GET /auth/me`
- `POST /auth/logout`
- `POST /auth/logout-all`
- `DELETE /auth/me`
- `GET /me/agreements`
- `PATCH /me/agreements`
- `GET /me/anime-list`
- `POST /me/anime-list`
- `PATCH /me/anime-list/:animeId`
- `DELETE /me/anime-list/:animeId`
- `GET /anime/search`
- `GET /me/anime/search`
- `GET /anime/:id`
- `GET /anime/:id/cast`
- `GET /me/anime-stats`
- `GET /me/anime-stats/genre-bubble`
- `GET /me/anime-stats/yearly-scores`
- `GET /me/anime-stats/format-distribution`
- `GET /me/anime-stats/studios`
- `GET /me/voice-actors/ranking`
- `GET /users/:userId/profile`
- `GET /users/:userId/anime-list`
- `GET /users/:userId/anime-stats`
- `GET /users/:userId/anime-stats/genre-bubble`
- `GET /users/:userId/anime-stats/yearly-scores`
- `GET /users/:userId/anime-stats/format-distribution`
- `GET /users/:userId/anime-stats/studios`
- `GET /users/:userId/badges`
- `GET /users/:userId/voice-actors/ranking`
- `GET /users/:userId/voice-actors/:voiceActorId/anime`

## Runtime Config

Pass backend and Supabase values with Dart defines when wiring real auth:

```sh
flutter run \
  --dart-define=API_BASE_URL=https://myanitrack.com/api \
  --dart-define=SUPABASE_URL=... \
  --dart-define=SUPABASE_ANON_KEY=...
```

Only the Supabase anon key belongs in the app. Never ship a service role key.

## Notes

This workspace currently contains the Flutter source and a minimal web target. Android/iOS platform folders should be generated with Flutter tooling when the local CLI is responsive:

```sh
flutter create --platforms=android,ios .
```
