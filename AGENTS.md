# Waste Hub working rules

- The user explicitly requested avoiding repeated Neon requests. All automated tests must use local PostgreSQL. `test:integration` enforces a loopback host and dedicated test database and ignores `.env`.
- The user later authorized connecting the running app to Neon. The ignored `.env` now contains that runtime configuration. Never print it or commit it. No credentials belong in source, docs, screenshots or logs.
- Use `npm run dev:local` for UI verification against the preserved ignored `.local/local.env`. Local DB commands can select it with `WASTE_HUB_ENV_FILE=.local/local.env`. Ordinary `npm run dev` / `npm start` use the configured application database.
- `npm run demo:local` serves a separate loopback demo on web port 3100 / API 4100, with an isolated Next build directory. `npm run demo:verify` performs the 18-checkpoint HTTP walkthrough against that local API only. Evidence is saved under `.local/demo-evidence`; the demo creates synthetic local records and never loads the Neon environment.
- Do not run migration/seed/status commands repeatedly against Neon. Initial provisioning has been completed in its dedicated `waste_hub` schema. Apply future migrations only when a schema change actually requires them. Remote demo seeding is intentionally blocked.
- Use explicit on-demand UI loading. No polling, focus/reconnect refresh or automatic error retry loops.
- Required verification: lint, TypeScript checks, unit tests, isolated local integration tests, production build. Repeat only for relevant changes or actual failures. No test may target Neon, even when remote runtime access is enabled.

- Code map: `docs/project-map.md`. Frontend route entries stay in `frontend/app`; feature code is in `frontend/src/features`. Backend modules are in `backend/src/modules`; Prisma and tests are under `backend/`.
- Run `npm run check:architecture` after structural changes. Preserve the route/schema/migration/style baseline unless the user authorizes a behavior change.
