# Review and implementation plan

The workspace was empty on 26 October 2026. The supplied plan is the specification, rather than an existing codebase. It describes a coherent modular-monolith MVP. It needs explicit decisions for concurrency, retry semantics, organization authorization, and test isolation.

## Decisions

- Next.js and Express are separate npm workspaces; Next proxies `/api` to Express, keeping cookies same-origin.
- Opaque hashed server sessions rotate on refresh. Permissions are attached to seeded roles; every application query is organization-scoped.
- Import runs commit records individually, quarantine invalid rows, use source natural keys and version hashes for idempotency, and retry only unresolved errors. A database-backed lock prevents concurrent writes for the same source.
- Governance audit events are append-only through a database trigger. Application mutation and its audit insert share transactions wherever practical.
- PostgreSQL via Docker Compose is supported. This Windows host has no Docker or psql installed, so an optional embedded PostgreSQL binary provides the local test/development database.
- Neon is never used by the test runner. Development and database scripts refuse remote addresses unless explicitly enabled; tests refuse them unconditionally. The user later explicitly authorized the Neon runtime connection; its dedicated schema was migrated and initialized once, with local configuration retained for verification.
- No polling, automatic focus refetch, retry storm, remote source URLs, or arbitrary SQL endpoints.

## Sequence

1. Foundation: workspaces, environment validation, schema, migration, deterministic synthetic seed, local database scripts.
2. Backend: sessions, authorization, audit, typed operations, CSV/mock imports, quarantine/retry, fourteen quality rules, governance and reports, OpenAPI.
3. Interface: service-reliability overview, operational tables/details, integration monitoring/import, DQM/remediation, governance editing, audit and CSV reporting.
4. Verification: one local unit/integration suite, lint/typecheck/build, migration/seed checks, bounded desktop/mobile UI review; fix actual failures only.

## Scope boundaries

Mock REST adapters use local synthetic provider data. Real providers, schedules, CDC infrastructure, production SSO, automated retention deletion, alert delivery, and a production deployment are future integrations. Retention/classification policies and source cursors are modeled now. The UI explicitly identifies synthetic seed data.
