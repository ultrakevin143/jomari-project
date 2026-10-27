# Delivery verification — 26 October 2026

For the latest acceptance result, see the [PowerPoint alignment review](integration-pptx-review.md): it supersedes the historical test counts below and includes the presentation flowchart and cross-project comparison.

This records the initial delivery. The subsequent [functional demo and DQM review](demo-review.md) expanded coverage to **43 automated tests and 18 demo checkpoints**, reproduced and fixed eight additional defects, and kept every test/demo operation local. Use that review for the current acceptance result and browser-verification limitation.

## Result

Working local Next.js + Express MVP, with its running application connected to the user-authorized Neon database. The runtime uses the dedicated `waste_hub` schema and the pooled URL; migrations use the direct URL. Secrets are only in ignored server configuration. The original local PostgreSQL environment remains available for development.

## Commands and observed outcomes

| Command / check                               | Outcome                                                                                                                                                                                          |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm install --no-audit --no-fund`            | Passed; lockfile retained. Node 22.23.2, npm 11.11.1.                                                                                                                                            |
| `npm run setup:local`                         | Passed; generated local passwords and ignored account-details file. Existing `.env` is preserved on subsequent runs.                                                                             |
| `npm run db:generate`                         | Passed; Prisma Client 6.19.3 generated without a database connection.                                                                                                                            |
| `npm run db:validate`                         | Passed; schema valid without a database connection.                                                                                                                                              |
| `npm run db:local`                            | Passed; embedded PostgreSQL listened on `127.0.0.1:54329`. UTF-8 initialization and coordinated Windows shutdown are implemented.                                                                |
| `npm run db:migrate`                          | Passed locally and once for authorized Neon provisioning. Three migrations applied. The local suite also applies all three to an empty isolated database.                                        |
| `npm run db:status`                           | Passed; schema up to date. Final development checks explicitly selected `.local/local.env` and confirmed `127.0.0.1:54329`.                                                                      |
| `npm run db:seed`                             | Passed locally, including a repeat run preserving canonical records. Remote demo seeding remains blocked.                                                                                        |
| `npm run lint`                                | Passed, zero warnings.                                                                                                                                                                           |
| `npm run typecheck`                           | Passed for API, web, seed and operator scripts.                                                                                                                                                  |
| `npm test`                                    | Passed: **10/10 unit tests**.                                                                                                                                                                    |
| `npm run test:integration`                    | Passed: **8/8 local PostgreSQL/API acceptance tests**, clean teardown.                                                                                                                           |
| `npm run build`                               | Passed: Express TypeScript and optimized Next.js production build.                                                                                                                               |
| `npm audit --omit=dev --audit-level=moderate` | Passed: **0 vulnerabilities**. CSV parser updated to 7.0.3; compatible deepmerge-ts 8 override removes the Prisma CLI advisory. Generate/validate/migrations and tests passed with the override. |
| `git diff --check`                            | Passed. Workspace initialized as a local Git repository; no remote or publish action.                                                                                                            |
| Secret boundary                               | `.env`, `.local/local.env`, account details, database files and QA captures are ignored. Source/documentation scan found no `npg_` credential values.                                            |

Local database commands after the Neon connection use `WASTE_HUB_ENV_FILE=.local/local.env`. The selector explicitly overrides Prisma's eager default-environment load. An initial selector attempt failed closed for migration/seed; its single status read used the configured Neon target. After fixing selection, local migration/status/seed commands completed against loopback. **No automated test used Neon.**

## Acceptance coverage

The isolated integration suite verifies liveness/readiness and headers, consistent API errors, body/query/path validation, forbidden origins, role authorization, organization-isolated reads and canonical foreign references, database-backed overview/report values, CSV idempotency, quarantine, corrected failed-only retries, persisted fourteen-rule scorecards, remediation preserving observed scores, version-checked governance, audit update/delete protection, audited CSV downloads, and session rotation/logout.

Unit tests cover remote-host guards, password verification, timestamp offsets and mass balance, citizen-request transitions, stable version hashes, CSV formula/quote escaping, the fourteen executable rule registry, within-run duplicate semantics, score formulas, and OpenAPI availability.

## Browser and design review

The sign-in, overview, integrations, corrected-record dialog, quality, governance, reports, audit and operational screens were inspected locally. All ten operational record types loaded their shared table. Main surfaces were checked at desktop and 390px phone widths; tables scroll inside their containers. Final DOM checks reported **390px viewport / 390px document width** on every main phone surface.

One mechanical detector run returned `[]`. The independent finish review identified five material fixes: mobile overflow, exception-date identity, stable source-update sorting, mobile chart labels and decorative page eyebrows. All were corrected in one batch and recaptured. The reviewer's final **ship** disposition scored all five fixes resolved, with no regressions in that batch; it was a verdict on those fixes rather than a new whole-surface review. The design documenter created and validated `DESIGN.md` and `.impeccable/design.json` from current source tokens. There are no shipping raster-asset obligations.

## Neon setup and restrained runtime check

- One schema-metadata inspection found no existing user tables.
- Three migrations initialized the dedicated application schema; no pre-existing data was replaced.
- The guarded initial-copy script transferred **450 synthetic workspace rows in one transaction**. Session tokens and source locks were excluded.
- The remote seed command was not used. The copy tool refuses a populated target and is not a sync/check loop.
- After all tests and UI review finished locally, the running application switched to Neon. One sign-in and one overview request returned **HTTP 200**, visible in safe request logs and the browser. The cold remote requests took approximately 6.8 and 5.8 seconds; loading states remained visible. No retry was submitted.
- The app remains at `http://localhost:3000/overview`. It has no polling, focus/reconnect refetch or automatic error retry. The preview viewport override was reset after screenshots.

## Changed files

The empty workspace now contains:

- Root npm workspace/lockfile, TypeScript/ESLint/Prettier configuration, `.gitignore`, sanitized environment examples, `compose.yaml`, and CI workflow.
- `apps/api/src`: Express bootstrap, environment guard, session/RBAC, typed canonical validation/repositories, source adapters/import/retry pipeline, DQM registry and execution, governance/audit, reports and OpenAPI.
- `apps/api/test`: unit and isolated API acceptance tests.
- `apps/web`: Next.js App Router shell, Radix/shadcn-style UI primitives, theme tokens, role-aware navigation, login, overview, all operational views, imports/correction, quality/remediation, governance editing, audit and reports.
- `prisma`: canonical schema, three migrations, deterministic synthetic seed.
- `scripts`: guarded database commands, UTF-8 embedded PostgreSQL runtime, local-only test runner/preview, metadata inspection and guarded initial workspace copy.
- `README.md`, `AGENTS.md`, `PRODUCT.md`, `DESIGN.md`, `.impeccable` design records, and `docs` covering the plan review, API, database safety, UI direction, runbook and this verification record.

## Limits and production follow-up

Docker/psql were unavailable on this host: Compose is provided but its container startup was not executed. Embedded PostgreSQL and fresh migration application were executed successfully. CI is authored but has not run on a hosted provider.

External provider adapters are local simulations; live credentials, scheduled jobs/CDC, SSO/password recovery and production hosting are not configured. Retention policies are metadata hooks. Permissions currently govern organization/module access rather than configurable per-asset entitlements. The MVP uses process-local rate limits/cache, synchronous capped imports and organization snapshots for quality scans. Before a public deployment, add a restricted database runtime role, durable workers/shared throttling, production identity provisioning, granular domain/asset entitlements, streaming exports where needed, external audit retention and tested backup recovery. The provided Neon owner credential is kept server-side; no new database credentials or grants were created.

## School presentation extension — 27 October 2026

Administrator-only user management, completed DQM trends with historical inspection, and collection reliability were implemented using existing database models. No migration, remote seed, remote test, runtime credential change or Neon cleanup was performed. Local unit checks: 11 passed. Isolated local integration checks: 35 passed, including account creation/authorization/tenant guards, stale edits, deactivation/session revocation, weighted trend scores and collection reliability counters. All three migrations and deterministic seed were verified in the disposable local test database. Lint, API/web/tools TypeScript and the final API/Next production build passed. Safe evidence is in ignored .local/school-* files.

Browser checks used localhost:3100 and API 4100 only. Real quality history increased from three to four runs after one explicit evaluation; historical selection and Latest snapshot restoration were verified. Collection period/area filters, route search, summary scope, route drill-through and mobile containment were checked. Blank user forms and administrator-self restrictions were inspected; account/permission mutations were tested through the isolated API suite rather than performed in the browser. Existing local records/accounts were preserved. Source-event gaps remain findings rather than fabricated evidence.

The independent UI review identified historical heading and numeric-alignment fixes. Both were applied, recaptured and scored resolved; the reviewer returned ship at that two-fix scope. Fresh evidence is in .impeccable/review/school. Design documentation preserves incumbent frontmatter/sidecar tokens and distinct green sidebar layout. The root lint configuration now excludes the independent nested John project, whose own lint/test/build commands run separately; this also prevents walking its temporary PostgreSQL directories during cleanup. No full accessibility, security-bypass or regulatory certification is claimed.

Presentation steps are in school-presentation.md. Forgot-password recovery, actual provider integrations, automatic retention and notifications are not included in this extension.
