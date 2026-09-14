# Administrator API summary

Catalog administration is documented in [catalog-api.md](./catalog-api.md). The active admin surface consists of direct catalog editing, private submission review, AI discovery runs, manual Korean-title editing, series maintenance, user administration, moderation, and maintenance mode.

The retired external catalog synchronization routes are intentionally unavailable.

## Operational overview

`GET /admin/overview` returns the read-only data used by the administrator dashboard in one authenticated request:

- catalog and registered-user totals
- pending user and AI catalog submissions
- pending profile reports and failed discovery runs
- maintenance mode and active/latest discovery state
- the next 03:00 KST discovery schedule
- the five most recent catalog submissions and discovery runs

The response is sent with `Cache-Control: no-store`. The public `/api/stats/platform` endpoint remains separate and does not expose moderation or service state.
