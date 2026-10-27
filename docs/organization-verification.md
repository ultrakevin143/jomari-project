# Organization verification — 27 October 2026

This records the organization-stage result. The later [Mercado Chrome review](browser-review.md) documents successful desktop interactions and the subsequently fixed sidebar overflow. Its narrowly reviewed CSS change has an updated architecture baseline; the unchanged-CSS statement below describes the earlier organization stage.

The Waste Operations Data Hub now uses `frontend/` and `backend/` npm workspaces. The landing entry is `frontend/app/page.tsx`. See [the project map](project-map.md) for feature locations and the browser-to-database request flow. The Water Utility project has been moved into its own Desktop folder.

| Check                                       | Result    |
| ------------------------------------------- | --------- |
| Architecture and original route contracts   | Passed    |
| ESLint                                      | Passed    |
| Backend, frontend and tools TypeScript      | Passed    |
| Unit tests                                  | 11 passed |
| Isolated local PostgreSQL integration tests | 35 passed |
| API and Next.js production builds           | Passed    |
| Local HTTP startup and routing              | Passed    |

Verification ran on Windows with Node.js 22. Integration coverage includes DQM, import/retry workflows, tenant isolation, permissions, governance and user/session administration.

The initial frontend build found a stale generated reference to the old `apps/web` depth. The generated Next.js build/demo caches were archived under `.local/organization-original/` and regenerated, after which the production build passed. The API was rebuilt after the final descriptive validation-schema renames.

The existing local demo on web port 3100 / API port 4100 returned HTTP 200 for `/`, `/quality` and `/users`. The web API proxy returned 401 for an unauthenticated `/api/auth/me` request. These HTTP checks do not establish that a user can enter protected screens; permission enforcement is covered separately by integration tests.

Browser automation returned “Local browser use is disabled in Work settings.” Visual appearance and interactive browser behavior were therefore not reverified during this organization. GitHub Actions was updated but was not run remotely.

Architecture checks confirm unchanged CSS, Prisma schema, historical migrations and API paths/mounts. Private runtime configuration and existing access files were preserved. No Neon tests, remote migrations, remote seeding, account changes, branches, commits, pushes or deployments were performed.

Original source, decomposed source files, generated caches and the pre-organization inventory remain privately archived under `.local/organization-original/`. Local verification logs are under `.local/organization-*.txt`; finite HTTP results are in `.local/organization-http.json`.
