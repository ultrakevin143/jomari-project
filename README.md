[Project map: frontend, backend and request flow](docs/project-map.md)

[Latest PowerPoint alignment review, flowchart and verification](docs/integration-pptx-review.md)

# Waste Operations Data Hub

A working municipal waste and recycling EDM MVP: **sources → integration → governance → outputs**. Next.js App Router and shadcn/ui/Tailwind provide the console; Express is the modular API; Prisma stores typed canonical records in PostgreSQL.

The workspace was initially empty. See [the plan review](docs/implementation-plan.md), [API details](docs/api.md), [database safety](docs/database-safety.md), [runbook](docs/runbook.md), and [verification record](docs/verification.md).

This checkout is now connected to the user-authorized Neon database through the ignored `.env`, using its dedicated `waste_hub` schema. The original local database configuration is preserved in ignored `.local/local.env`. Use `npm run dev:local` or `npm run start:local` for browser verification without touching Neon. A fresh clone still follows the local setup below. No connection secrets are included in this repository.

For a separate local demonstration while the Neon-backed app remains configured, run `npm run demo:local` and open [the local demo](http://localhost:3100). It uses API port 4100 and `.next-demo` build output. In another terminal, `npm run demo:verify` executes the import → quarantine → correction → DQM → remediation → governance → export → audit walkthrough and saves its actual results to `.local/demo-evidence/results.json`. It creates clearly identified synthetic local records. See [the detailed demo review](docs/demo-review.md).

## Local setup

Prerequisites: **Node.js 22.12+ and npm 11+**. These commands run from this repository root in PowerShell, macOS or Linux. `npm install` includes a development-only embedded PostgreSQL binary; allow its normal install scripts. Docker is an alternative, not a requirement for the embedded path.

```powershell
npm install
npm run setup:local
npm run db:generate
npm run db:local
```

Leave that PostgreSQL process running. In another terminal:

```powershell
npm run db:migrate
npm run db:seed
npm run dev
```

Open [the workspace](http://localhost:3000). Local account emails and the generated password are in `.local/development-access.md`. The file and `.env` are ignored. Setup never overwrites an existing `.env`; it generates passwords instead of shipping a shared default credential. Seed accounts are `admin@wastehub.demo`, `operator@wastehub.demo`, `steward@wastehub.demo`, and `analyst@wastehub.demo`.

The frontend uses port **3000**, Express **4000**, embedded/Docker PostgreSQL **54329**, and the isolated integration suite **54330**. Use `localhost:3000` in the browser: this matches the configured allowed origin. The Next.js `/api` rewrite forwards same-origin cookies to Express; database credentials never enter the browser.

To use Docker instead of embedded PostgreSQL, configure `.env` using `.env.example`, supply your own matching password, and run:

```powershell
$env:LOCAL_DB_PASSWORD = 'YOUR_LOCAL_DATABASE_PASSWORD'
docker compose up -d postgres
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Do not run Docker and the embedded server on the same port. PostgreSQL data stays in a local volume or ignored `.local/postgres`. The seed is repeatable and uses stable identities/idempotency keys. It preserves existing records rather than deleting/recreating the database. It does not rotate existing account passwords on rerun.

## What works

- Secure, HTTP-only opaque sessions, login/logout and session rotation; scrypt password hashes; four roles and server permissions.
- An organization-scoped service overview, date filters, live database aggregates, daily collection chart, source freshness, and route drill-downs.
- Governed lists and details for collection routes/events, vehicles/telemetry, facilities, weighbridge receipts, recycling, work orders, citizen requests, and contracts; filtering, sorting and pagination. Supported core records can be explicitly archived with a reason.
- Seven source registries, CSV batch ingestion, **local mock REST adapters**, typed canonical transforms, version hashes, source cursors, natural-key idempotency, quarantine, individual corrected-payload retry, and failed-only batch retry. No arbitrary external URLs are accepted.
- Fourteen executable DQM rules, persistent runs/results, configurable rule thresholds, per-domain scores, severity filters, offending samples, and audited remediation notes. A remediation label never rewrites an observed score.
- Domain ownership/stewardship, asset classifications, PII tags, retention policy metadata, source-to-output lineage, version-checked policy editing, and append-only audit events.
- UTC-period operations and diversion reports, preview pagination, CSV downloads with formula escaping and audit events.
- Theme switching, responsive Sheet navigation, accessible Radix dialogs/selects/tabs, loading/error/empty/permission states, rate limits, safe logs, request IDs and OpenAPI 3.1 at [the API reference](http://localhost:3000/api/docs).

Synthetic seed data covers **20–26 October 2026**: 56 daily route records, 12 vehicles, 3 facilities, 42 weighbridge tickets, 21 recovery records, 5 work orders, 8 citizen requests, and 3 contracts. A deliberately invalid weighbridge row demonstrates quarantine; a delayed service source and a 645-minute route demonstrate quality findings. These are database records, not frontend fixtures. The overview defaults to the latest collection date; use its date controls to inspect other periods. Operational timestamps are stored as UTC; reports use inclusive UTC calendar dates. Organization timezone metadata remains available for future local-calendar reporting.

## Architecture

```text
Browser → Next.js :3000 → /api proxy → Express :4000
                                      ├─ Sessions / permissions
                                      ├─ Operations / canonical model
                                      ├─ CSV / local REST adapters / retries
                                      ├─ DQM snapshot and rule registry
                                      ├─ Governance / immutable audit
                                      └─ Aggregate reports
                                             ↓
                                          Prisma
                                             ↓
                                    PostgreSQL / Neon
```

`backend/src` contains domain modules and server authorization. `frontend/components/ui` contains locally maintained shadcn-style components built on Radix, with `components.json` configured for additions. Shared tokens are in `frontend/app/globals.css`. `prisma` contains the schema, migrations and seed; `scripts` contains database guards and the local acceptance runner.

## Source-to-output mapping

| Source                | Method / canonical entities                          | Governance                                  | Useful output                            |
| --------------------- | ---------------------------------------------------- | ------------------------------------------- | ---------------------------------------- |
| Collection management | CSV / mock REST → routes, stops, events              | Collection domain; operations owner         | Completion, missed stops, service report |
| Fleet                 | CSV / mock REST → vehicles, telemetry                | Fleet manager; internal classification      | Fleet status, utilization, maintenance   |
| Weighbridge           | CSV / mock REST → facilities, tickets, material refs | Resource recovery owner; mass-balance rules | Waste received and diversion denominator |
| Recycling facility    | CSV / mock REST → recovery, contamination            | Materials domain; recovery consistency      | Recovery and weighted contamination      |
| Work orders           | CSV / mock REST → maintenance orders                 | Fleet domain; workshop steward              | Open maintenance work                    |
| Contracts / vendors   | CSV / mock REST → contracts, areas, SLA metadata     | Municipal services owner                    | Contractor and SLA records               |
| Citizen service       | CSV / mock REST → requests, valid state transitions  | Confidential, PII designation; aliases only | Active requests and closure history      |

## Verification

```powershell
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run build
npm run db:validate
npm run db:status
```

`test:integration` creates its own local PostgreSQL instance, applies all migrations to an empty database, runs deterministic seeding and API acceptance tests, then stops it. It **does not load `.env` or use `DATABASE_URL` from your environment**. Optional `TEST_DATABASE_URL` must be loopback and named `waste_hub_test` or `waste_hub_test_<suffix>`; remote hosts are unconditionally rejected. CI supplies a local PostgreSQL service instead of embedded binaries. No Neon connection is needed for install, lint, typecheck, unit tests or build.

The tests cover API error contracts, authorization, organization isolation, cross-tenant database reference guards, CSV idempotency, invalid-row quarantine, corrected failed-only retry, persisted DQM, optimistic policy versions, immutable audits, CSV exports, CSRF origin checks, and session rotation.

## Neon and deployment

Use `.env.production.example` on the deployment host. Use a **pooled Neon URL** for `DATABASE_URL` and the **direct URL** for `DIRECT_URL`; include `sslmode=require` and start with `connection_limit=5`. Runtime identity should have only necessary table privileges; migrations use a separate owner credential. Runtime and migration values are server secrets. Keep development, staging and production in separate databases/Neon branches.

Remote connections are off by default. An intentional deployment sets `ALLOW_REMOTE_DATABASE=true`. The guarded migration script additionally requires `CONFIRM_REMOTE_WRITE=waste-hub-migrations`. Demo seeding is blocked for **every remote database** and for production. Run migrations once as a release job, not at every API startup. Do not point local tests at Neon.

Build with `npm ci`, `npm run db:generate` and `npm run build`, then start both services with `npm start` or supervise the workspaces separately. Next reads `API_ORIGIN` when building its rewrite: set it to the internal Express address before the build. The API start command expects a root `.env`; a production platform can instead invoke `node backend/dist/server.js` with injected environment values. Next starts on loopback by default: expose it through your reverse proxy (or explicitly change the bind address for a container). Terminate HTTPS at the proxy; configure `WEB_ORIGIN` to its exact public origin. Configure trusted forwarding and a shared rate-limit store before running multiple API instances; default auth/ingestion limits are process-local. Preserve secure cookies and origin checks.

`/health` is liveness and never queries the database. `/ready` checks PostgreSQL on demand with a 30-second cache; probes should be conservatively spaced. Browser views do not poll, refetch on focus/reconnect, or retry automatically. One manual refresh loads the selected view. The overview has a short organization-scoped cache, invalidated by successful changes. This protects request budgets; it is not a substitute for load testing and production capacity planning.

## Boundaries and next production work

This is a production-minded MVP. Live provider credentials, scheduled ingestion, background workers, real CDC, enterprise SSO/password recovery, alert delivery, database row-level security, automatic retention enforcement, fully streamed large exports and production hosting are not configured. Mock REST adapters are in-process provider simulations. Synchronous imports are limited to 500 rows, with a ten-minute source lease; use durable jobs for larger workloads. Quality runs take one organization snapshot and are suited to MVP data volume. Readiness/proxy configuration and process-local throttles need deployment-specific settings.

The application and database triggers enforce organization references; database administrators can still change schema/triggers. Use external append-only audit storage and tighter database roles for stronger tamper resistance. Retention policies are documented metadata hooks, not automated deletion. See the runbook before operating a real database.

## School presentation additions

The administrator-only **Users** page creates accounts and edits names, roles and active access, with required audit reasons, stale-edit protection and session revocation on role/access changes. Self-lockout and removal of the last active administrator are rejected. No invitation email is sent; no password recovery or MFA service is implied.

**Data quality → Quality trends** shows up to 12 actual completed snapshots and weighted domain changes. In this application, a PARTIAL DQM run means evaluation completed with findings, so it is included; execution failures are excluded. Inspect run opens that saved snapshot, and Latest snapshot restores current results. New runs invalidate history/trends without polling.

**Collection reliability** uses inclusive UTC dates and service-area filtering to expose missed stops, overdue routes, vehicle assignments, stop-counter consistency and absent collection-event evidence. Missing evidence is not proof of a missed collection. Search filters only rows; summary totals retain period/area scope. See [the school walkthrough](docs/school-presentation.md). All additions use existing tables; no migration, remote seed or credential change is needed.
