# Database safety and request budgets

The user's constraint is to avoid repeated Neon requests. Automated tests and UI review use **zero Neon requests**. The user subsequently supplied a Neon connection and explicitly authorized connecting the running application; that setup is separate from testing.

## Authorized connection

The ignored server `.env` now selects the pooled Neon endpoint with SSL, a five-connection cap, and the dedicated `waste_hub` schema. `DIRECT_URL` uses its direct endpoint for migrations. No existing user tables were found during the single metadata inspection. Three migrations were applied once, and 450 rows from the verified local synthetic workspace were copied in one transaction. Existing session tokens and source locks were excluded. No Neon management API was used.

The original local configuration remains in `.local/local.env`. `npm run dev:local` / `npm run start:local` inject that environment before launching the app; Node's `--env-file` does not overwrite those explicit local values. Database scripts can use `WASTE_HUB_ENV_FILE=.local/local.env`. This keeps all further development and browser checks local while normal application startup uses the requested Neon database.

`scripts/copy-local-workspace.ts` is a deliberately guarded first-workspace tool, not a general sync or remote seed command. It requires an explicit confirmation environment value, a local source, the dedicated demo schema, and every application table to be empty. It refuses an existing workspace. Do not run it again as a connectivity check.

| Operation                                                                         | Database behavior                                                                                  |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Install, generate, schema validate, lint, typecheck, unit tests, production build | No database connection                                                                             |
| `db:local`                                                                        | Starts an embedded server, bound to loopback                                                       |
| `db:migrate`, `db:status`, API startup                                            | Validate URLs before constructing a client; remote addresses blocked by default                    |
| `db:seed`                                                                         | Loopback, non-production only; no remote demo seed                                                 |
| `test:integration`                                                                | Ignores `.env`; dedicated local test database only, regardless of opt-in flags                     |
| Dashboard navigation                                                              | On-demand requests, cache deduplication; no polling, focus/refocus, reconnect or automatic retries |
| Quality run                                                                       | Explicit action, one data snapshot reused by all fourteen rules                                    |
| Health / readiness                                                                | Liveness has no SQL; readiness caches successful checks for 30 seconds                             |

Do not change environment URLs to Neon for local verification. `ALLOW_REMOTE_DATABASE=true` is only for intentionally deployed services. The migration script also requires `CONFIRM_REMOTE_WRITE=waste-hub-migrations` on a remote host. Protect those settings as deployment configuration, not testing defaults. Prisma CLI can bypass wrapper-script guards if invoked directly; use the documented guarded scripts for database operations. Build/generate are connection-free, but a raw `prisma migrate` command is not guarded.

The source ingestion API processes at most 500 rows synchronously and commits each canonical change with its raw-record state. Its source lease serializes a source's imports. Idempotency keys are scoped by organization and source; the same key and parsed rows return the existing run. Different content with that key returns 409. A new key for identical canonical source content skips unchanged records through stable version hashes. Older timestamps cannot overwrite newer data.

Retries select only unresolved quarantined errors. A corrections array selects individual failed rows, and an empty array retries all unresolved failures. Already loaded records are not processed. Corrected payloads are retained as the latest raw payload and canonical version; audit history records the correction action and record/run IDs. Original source files should be retained in controlled object storage for stronger historical payload provenance in production.
