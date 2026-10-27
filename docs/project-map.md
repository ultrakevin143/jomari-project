# Waste Operations Data Hub: project map

Verification results and limitations: [organization verification](organization-verification.md).

Latest presentation requirements and functional checks: [PowerPoint alignment review](integration-pptx-review.md).

Desktop interactions and the laptop-height sidebar fix: [Mercado Chrome review](browser-review.md).

The project root contains **frontend/** and **backend/** as independent npm workspaces. Run the documented npm commands from this root. This organization preserves the existing Next.js App Router, Express API, URLs, permissions, styles and database schema.

## Start here

| Task                                                       | Location                                                                        |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Landing route `/`                                          | `frontend/app/page.tsx`                                                         |
| Existing workspace URLs                                    | `frontend/app/[...path]/page.tsx`                                               |
| Page metadata / global layout                              | `frontend/app/layout.tsx`                                                       |
| Global theme and responsive styling                        | `frontend/app/globals.css`                                                      |
| Navigation, session and page selection                     | `frontend/src/app-shell/workspace.tsx` and `navigation.ts`                      |
| On-demand SWR provider settings                            | `frontend/src/app-shell/providers.tsx`                                          |
| Reusable Radix controls                                    | `frontend/src/shared/ui/index.tsx`                                              |
| Pagination, search, loading/errors and record details      | `frontend/src/shared/data-display/`                                             |
| Browser HTTP client                                        | `frontend/src/shared/api/client.ts`                                             |
| Common response/session contracts                          | `frontend/src/shared/api/contracts.ts`                                          |
| Shared formatting and classes                              | `frontend/src/shared/lib/utils.ts`                                              |
| Public assets                                              | `frontend/public/` when assets are needed; no empty asset directory is required |
| API startup / shutdown                                     | `backend/src/server.ts`                                                         |
| Express setup and route mounting                           | `backend/src/app.ts`                                                            |
| Environment validation                                     | `backend/src/config/env.ts`                                                     |
| Prisma client lifecycle                                    | `backend/src/database/client.ts`                                                |
| Session, authorization, origin, request logging and errors | `backend/src/middleware/`                                                       |
| API documentation generation                               | `backend/src/docs/openapi.ts`                                                   |
| Database schema and immutable migration history            | `backend/prisma/`                                                               |
| Unit, integration tests                                    | `backend/tests/`                                                                |
| Architecture baseline                                      | `backend/tests/architecture/baseline.json`                                      |

The landing page opens the existing workspace/login. It is not a new marketing page. The frontend alias `@/*` resolves to `frontend/src/*`.

## Features

| Feature                                   | Frontend                     | Backend                                                            |
| ----------------------------------------- | ---------------------------- | ------------------------------------------------------------------ |
| Login and sessions                        | `src/features/auth/`         | `src/modules/auth/` plus session middleware                        |
| User administration                       | `src/features/users/`        | `src/modules/users/`                                               |
| Overview                                  | `src/features/overview/`     | overview operation in `src/modules/reports/`                       |
| Operational records                       | `src/features/operations/`   | `src/modules/operations/`                                          |
| Import monitoring/correction/retry        | `src/features/integrations/` | `src/modules/integrations/`                                        |
| DQM rules, snapshots, findings and trends | `src/features/quality/`      | `src/modules/quality/`; trend aggregate in `src/modules/insights/` |
| Governance policy                         | `src/features/governance/`   | `src/modules/governance/`                                          |
| Audit                                     | `src/features/audit/`        | `src/modules/audit/`                                               |
| Reports and CSV export                    | `src/features/reports/`      | `src/modules/reports/`                                             |
| Collection reliability                    | `src/features/reliability/`  | `src/modules/insights/`                                            |

Frontend paths in this table are relative to `frontend/`; backend paths are relative to `backend/`. Screens use `<feature>.screen.tsx`. Feature-only editors, diagrams, definitions and types stay alongside their feature. Common controls and application navigation do not depend on a feature screen.

## Backend responsibilities

- `*.routes.ts`: route paths, permission guards, rate limits and controller binding.
- `*.controller.ts`: Express request/response handling, cookies, statuses and downloads. Controllers do not execute Prisma queries.
- `*.service.ts`: business workflows and orchestration, with transport-neutral inputs/context. Services retain transaction ownership and transaction-bound operations so audit writes and existing lock/version checks remain atomic.
- `*.repository.ts`: named user/session lookups, operational queries, quality snapshots, canonical adapters and reporting-query workflows. Small transaction-local queries remain inside services; no generic repository framework or forwarding-only classes were added.
- `*.schemas.ts`: feature validation. Canonical field validation is in `modules/canonical/canonical.schemas.ts`.
- `quality.rules.ts`, `quality.engine.ts` : rule metadata, executable checks separate from HTTP handling.
- `shared/`: focused error, validation/pagination, identity/context, hashing/security, audit and CSV helpers.

Only files with a real responsibility exist; a module is not forced to contain an empty controller/repository/schema file.

## How a request reaches the database

For example, the Users screen calls `api('/users')` in the shared client. The browser requests `/api/users`. `frontend/next.config.ts` rewrites it to Express, where request protection and session middleware run before `backend/src/app.ts` mounts `/users`. The users route enforces the administrator guard, the controller collects input/context, and the service validates input and applies business rules. Named repository queries or the service-owned transaction use Prisma against the configured database. The controller returns the existing envelope, status and cookies. Errors reach `middleware/error-handler.ts`.

## Tooling and verification

- Root `scripts/dev/local-preview.ts`: local/demo process orchestration.
- Root `scripts/demo/walkthrough.ts`: finite local HTTP demonstration.
- Root `scripts/check-architecture.ts`: checks imports, dependency directions, runtime cycles, original API route paths/mounts and unchanged schema/migrations/CSS. It does not load environment files or contact a database.
- CI runs this architecture check. Intentional future API or styling changes require reviewing the corresponding baseline in `backend/tests/architecture/baseline.json`; historical migrations remain immutable.
- `backend/scripts/`: database setup, local PostgreSQL, test-cluster runner and maintenance utilities. These commands retain their loopback guards and root-relative ignored configuration.
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:integration`, and `npm run build` are the independent verification commands.

Ignored `.env` and `.local/local.env` remain at the project root. Never print or commit them. Database tests always use disposable local PostgreSQL. Organization did not change a schema, apply a remote migration, seed Neon, alter accounts or clean runtime data. Original source snapshots are privately retained in `.local/organization-original/`; they are not active source or an alternate runnable project. Historical verification documents may mention pre-organization `apps/web` and `apps/api` paths; this map describes the current locations.
