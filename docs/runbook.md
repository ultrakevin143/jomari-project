# Operations and incident runbook

## Failed import

1. Open Integrations and inspect the run and quarantine reason. A partial batch retains its successes.
2. Correct only the failed payload, preserving its stable source ID and supplying a timezone-aware update timestamp. Retry that row; unchanged successful records are never replayed.
3. Review resulting counts and audit events. If the source itself was wrong, fix the upstream export and use a new idempotency key. The same key cannot be reused with different content.
4. An interrupted RUNNING run may contain PENDING records and needs operator recovery after confirming the process is dead. Do not force an active source lease open. The lease expires in ten minutes. Preserve raw/error evidence, mark the interrupted run FAILED in a controlled operator script, and reimport its source file under a new key: natural keys/version hashes skip committed successes. This MVP has no automated crash-recovery worker.

## Database unavailable

Check the local PostgreSQL/Compose process, selected port and environment configuration. Use `/health` for process liveness; use `/ready` for a single connectivity check. Do not repeatedly refresh readiness or restart a Neon instance in a loop. For Neon, check the endpoint, pooling hostname, SSL requirement, secret validity, connection cap and provider status. Logs expose only correlation IDs and safe error types; inspect restricted platform logs for infrastructure context, never paste connection strings into tickets.

## Bad migration / rollback

1. Stop rollout and preserve the current release/migration logs. Run `npm run db:status` once against the intended environment.
2. Prefer a forward corrective migration. Prisma migrations are not automatic reversible scripts. A previously applied migration must not be edited.
3. If the application is incompatible, restore the prior compatible release while retaining the schema. Destructive schema changes need an expand/migrate/contract rollout.
4. Restore to a tested pre-migration backup or Neon recovery point only when forward repair is unsuitable. Restoring can lose newer writes; coordinate a maintenance window and retain a copy of the failed database.
5. Use Prisma `migrate resolve` only after understanding and manually correcting the actual SQL state. Never mark an unexecuted migration as applied merely to hide an error.

## Backup and restore

For PostgreSQL, run `pg_dump --format=custom --file=<secure-path>` with a restricted connection supplied through `PGSERVICE`/`PGPASSFILE` or secret injection. Keep passwords out of command arguments/history. Encrypt backups, restrict access, and store them off-host. Include role/privilege definitions separately. Agree RPO/RTO and retention with the municipality; verify the selected Neon plan's actual restore window in its console.

Restore into a **new isolated database**, using `pg_restore --no-owner --dbname=<isolated-service> <backup>`. Check schema/migration status, organization counts, known reports and audit history, then perform a controlled connection switch. Avoid `--clean` against a live database. PostgreSQL client utilities are required for this workflow; they are not installed by the app. Use the matching version's client tools or a trusted PostgreSQL container. Test restoration periodically on local/staging data, never by overwriting production.

## Credential exposure

Revoke and rotate the affected database/provider secret in the issuing service. Update the deployment secret store; restart affected services in a controlled rollout; invalidate exposed sessions by deleting their session records. Preserve audit history. Review access and time window, quarantine suspect imports, and coordinate any notification obligations with the designated owner. Remove the credential from repository history if committed, but treat rotation as required even after removal. Do not seed production with local identities.

## Authentication / proxy issues

Browser origin must match `WEB_ORIGIN`. In production use HTTPS, Secure cookies, and same-origin `/api` forwarding. Ensure the build's `API_ORIGIN` points to reachable Express infrastructure. Bind Express privately where possible. Configure an exact trusted proxy policy and shared rate-limit store for a real proxy/multiple instances. Do not globally trust arbitrary forwarded headers. Default process-local limits are 20 login attempts per 15 minutes and 10 ingestion requests per minute.

## Retention, audit and quality

Retention fields are metadata; no automatic deletion task runs. The operational archive is a soft delete for supported entities. Audit events cannot be updated, deleted or truncated through ordinary SQL because of triggers. The migration owner can disable triggers, so use a separate least-privilege runtime role and external append-only retention for stronger controls. Avoid granting runtime CREATE/ALTER/TRUNCATE.

Quality scans are explicit user actions, not scheduled queries. Examine the rule code, denominator and samples before treating a score as service performance. Acknowledging a result changes the workflow state only; correct data and run checks again to measure improvement. Change threshold metadata through a reviewed migration/operator process until an audited rule-configuration UI is added.
