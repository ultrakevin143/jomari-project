# School presentation walkthrough

Start with the [PowerPoint alignment review](integration-pptx-review.md), which includes the source-to-output flowchart, comparison with Water Hub, verified capabilities and assignment limitations.

Use the separate local demo at `http://localhost:3100`, API 4100 and local PostgreSQL 54329. Start PostgreSQL using `.local/local.env`, then `npm run demo:local`. Never seed or test Neon. Existing demo records/accounts are preserved.

## Accounts and governance

Sign in with the existing administrator account. Open **Users**, search accounts and inspect **Create account**. Explain the name, memorable email, distinct initial password, role and mandatory audit reason. No invitation email is sent; share a chosen password privately, never in slides. Edit an account to demonstrate active/inactive access and role assignment. Deactivation preserves history; role/access changes revoke sessions. Self-lockout, stale edits, foreign roles and removal of the last active administrator are rejected. Local administrator-assisted recovery is described in [the recovery guide](password-recovery-plan.md); MFA remains future work.

## Quality history

Open **Data quality → Quality trends**. The graph and exact-value table compare up to 12 actual completed runs; no artificial history is created. In Waste Hub, PARTIAL means completed evaluation with findings, so those runs belong in the comparison. Failed executions and unfinished runs are excluded. Domain scores use observation counts, not an average of percentages. No observations is unavailable in the trend; changing rule/record coverage can affect comparisons.

Choose **Inspect run** to review its saved score/rules and **Latest snapshot** to return to current results. Demonstrate a local correction and one explicit quality run, then compare the updated history. No dashboard polling occurs. On mobile, tables/graph scroll within their own regions.

## Collection reliability

Open **Collection reliability** from the sidebar. The default reporting period follows the most recent unarchived route and six preceding UTC days. Dates are inclusive. Choose a service area; compare scheduled/completed/missed stops, stop completion percentage, overdue routes and assignment/source-evidence findings.

Overdue means planned start plus recorded duration has passed and the route is not completed. A completed shift may have missed stops; its completed plus missed counts should reconcile to the scheduled count. Findings can overlap. No event evidence is a data gap requiring investigation, not proof that a collection was missed. Search narrows the table while summary totals retain date/area scope. Open a dated route link to see lineage.

## Evidence and limits

All tests use disposable local PostgreSQL, including fresh migration and seed checks. Existing tables support the additions, so no migration or remote write is required. Screenshots are under ignored `.impeccable/review/school`. Actual provider connections, invitations/recovery/MFA, notifications and automated retention remain outside this school release. See the API and verification documents for contracts and actual test results.
