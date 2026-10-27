# Functional demo and DQM review — 26 October 2026

## Verdict

**The tested MVP workflows work after fixing the defects found during this review.** This run passed 43 automated tests (11 unit, 32 integration including the 14 DQM subtests) and a separate 18-checkpoint HTTP demo. Every automated test and demo operation used local PostgreSQL. This run issued **zero test/demo requests to Neon**; its configuration and data were preserved.

This is a functional acceptance result against the project plan. It is not certification that every possible security, accessibility, legal, or industry standard has been satisfied. The implementation's documented production limits still apply.

## Reproduce the demo

The local PostgreSQL server must already be running. The separate demo does not replace the application's Neon environment:

```powershell
npm run demo:local
```

Open `http://localhost:3100`. The demo API is `http://127.0.0.1:4100`; it uses the preserved `.local/local.env`, a loopback-only guard, and separate `.next-demo` output. The configured Neon-backed app continues to use ports 3000/4000.

In another terminal:

```powershell
npm run demo:verify
```

This command makes an intentional, finite series of local HTTP calls. It creates uniquely named synthetic local records, exercises four roles, and saves `.local/demo-evidence/results.json` and `operations.csv`. It never loads the remote `.env` and never constructs a remote database client. Local account details are in ignored `.local/development-access.md`; no credentials or session tokens are saved in the evidence.

## Observed walkthrough

Demo ID: **32b66eaf**. All 18 checkpoints passed.

| Checkpoint                                                   | Observed result                                                                                                                                                                                         |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1–4: Sign in each seeded role                                | Administrator, integration operator, data steward and analyst authenticated with their actual permissions.                                                                                              |
| 5: Import CSV with one valid and one invalid weighbridge row | 1 loaded, 1 quarantined. Negative net weight was rejected with a validation reason.                                                                                                                     |
| 6: Replay the identical batch with the same key              | Returned the existing run; no duplicate loading.                                                                                                                                                        |
| 7: Correct and retry the failed row                          | Run became SUCCEEDED with 2 loaded and 0 quarantined.                                                                                                                                                   |
| 8: Import a 900-minute route and run DQM                     | All 14 result rows persisted; the outlier rule flagged the route. The score was independently recalculated from result counts.                                                                          |
| 9: Acknowledge the finding                                   | Remediation note and state saved; observed score stayed unchanged.                                                                                                                                      |
| 10: Correct route duration and run DQM again                 | Failed checks decreased from **3 to 2**; score rose from **99.66% to 99.78%**. The second run had one additional duplicate-check observation because the correction created a new immutable import row. |
| 11: Review governance policy                                 | Steward policy save succeeded; repeating the stale version returned 409.                                                                                                                                |
| 12: Attempt analyst writes / restricted audit access         | Ingestion, DQM execution and audit access returned 403 from the backend.                                                                                                                                |
| 13: Read citizen requests                                    | Operational response omitted citizen identity aliases.                                                                                                                                                  |
| 14: Export report                                            | Non-empty CSV downloaded; export event persisted.                                                                                                                                                       |
| 15: Inspect audit trail                                      | Import start/completion, corrected row, retry, DQM start/completion, remediation, governance and export actions were present.                                                                           |
| 16: Read dashboard                                           | Overview used the latest persisted quality score and all seven sources.                                                                                                                                 |
| 17: Fetch frontend                                           | Next.js returned HTTP 200 and `nosniff` / frame-denial headers. This verifies HTTP delivery, not browser interaction.                                                                                   |
| 18: Sign out all four roles                                  | Every logged-out cookie failed the current-user check with 401.                                                                                                                                         |

The two remaining data-quality findings are deliberate seed examples: **one source outside its freshness window** and **one seeded 645-minute route** exceeding the configured 600-minute threshold. They demonstrate detection; they are not hidden by changing a remediation label or falsifying the score. The initially invalid seed weighbridge row remains quarantined separately from canonical DQM scoring.

## All fourteen rules exercised

Each rule was evaluated with a known clean fixture and a controlled defect derived from seeded canonical records. Failures must produce a count and a bounded, understandable offending sample.

| Rule                | Controlled defect                                     | Result                                                       |
| ------------------- | ----------------------------------------------------- | ------------------------------------------------------------ |
| COMPLETENESS        | Whitespace-only route name                            | Detected; clean fixture passed                               |
| TIMESTAMPS          | Vehicle source-update timestamp before 2000           | Detected; timezone parsing also has unit coverage            |
| NON_NEGATIVE        | Negative route duration                               | Detected; null/boolean/blank numeric ingestion also rejected |
| MATERIAL_REFERENCE  | Unknown material UUID                                 | Detected                                                     |
| SOURCE_DUPLICATES   | Repeated source ID in the same batch                  | Detected; historical replays remain allowed                  |
| VEHICLE_IDENTIFIERS | Same registration with different case                 | Detected                                                     |
| EVENT_REFERENCES    | Unknown collection route reference                    | Detected                                                     |
| COLLECTION_STATUS   | Completed stops exceed scheduled stops                | Detected                                                     |
| NET_WEIGHT          | Net mass differs from gross minus tare                | Detected                                                     |
| RECOVERY_BALANCE    | Recovery exceeds receipts without exception           | Detected                                                     |
| REQUEST_TRANSITIONS | OPEN directly to CLOSED                               | Detected                                                     |
| SOURCE_FRESHNESS    | Success timestamp outside configured freshness window | Detected                                                     |
| OUTLIERS            | Duration above the configured upper threshold         | Detected                                                     |
| CLASSIFICATION      | PII asset tagged PUBLIC                               | Detected; policy-update API also refuses it                  |

Rule evaluation now reads source metadata, all ten canonical entity types, governance and import observations from a **Repeatable Read transaction**. Numeric validation rejects missing or non-numeric values while preserving valid zero and CSV numeric text. Quality starts are serialized by an organization-scoped advisory lock; a misconfigured check fails closed and creates a failure audit event. Remediation does not alter historical failed counts.

## Final verification commands

| Command                                       | Current result                                                                                                                                                               |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`                                    | 11/11 unit tests passed                                                                                                                                                      |
| `npm run test:integration`                    | 32/32 integration tests, including the fourteen DQM subtests, passed; clean local database shutdown                                                                          |
| `npm run demo:verify`                         | 18/18 workflow checkpoints passed; 37 finite local API requests, no retries/polling                                                                                          |
| `npm run lint`                                | Passed, zero warnings                                                                                                                                                        |
| `npm run typecheck`                           | Passed for API, web, tests and scripts                                                                                                                                       |
| `npm run build`                               | Passed; Express TypeScript plus optimized Next.js build                                                                                                                      |
| `npm audit --omit=dev --audit-level=moderate` | 0 vulnerabilities reported                                                                                                                                                   |
| `git diff --check`                            | Passed                                                                                                                                                                       |
| Migration/seed verification                   | Existing three migrations applied to a fresh isolated local database and deterministic seed completed through the integration runner; no remote migration or seed was needed |

The local API demo timings averaged about **92 ms**, with a maximum of **877 ms**, over 37 requests on this machine. This is a short functional observation, not a production load or performance benchmark. Frontend compilation/delivery time was checked separately.

## Defects found and fixed

The regression cases first reproduced the failures, then passed after correction:

1. Required numeric fields accepted `null`, booleans and arrays through JavaScript number coercion. They now accept finite numbers or non-empty numeric strings only; telemetry coordinates receive the same treatment.
2. Completeness checks treated whitespace-only canonical fields as populated. They now trim before checking presence.
3. Timestamp scans omitted source-update fields, vehicles, facilities, telemetry, work orders and contracts. They now cover them, distinguishing legitimate future schedules/due dates from future event/update timestamps.
4. Quantity scans omitted route duration, telemetry and contract quantities. They now include them and check finite values and percentage bounds.
5. Vehicle duplicate checks compared case-sensitive identifiers. They now normalize case and surrounding whitespace.
6. CSV parsing silently accepted duplicate headers and replaced earlier values. Duplicate or invalid column names now reject the batch before loading.
7. A disabled adapter could run if any other connection for the source was enabled. Authorization now checks the selected adapter.
8. Retrying a duplicate source row could overwrite the successful row in the same batch. It now remains quarantined until the conflicting ID is corrected. Retry state is re-read under the source lock, and lock cleanup matches the acquired lease.

The review also hardened DQM concurrency and snapshot consistency, and added explicit start/failure audit events without requiring a new database migration.

## Security and acceptance checks

The expanded local suite verifies organization isolation at API and canonical-reference database boundaries; role restrictions; scrypt password verification; session rotation and logout; production Secure/HttpOnly/SameSite cookie attributes; safe error envelopes; rejected cross-site/untrusted-origin writes; invalid JSON, unsupported media and 2 MB body limits; authentication throttling; CSV formula escaping; audited exports; optimistic governance versions; and append-only audit update/delete protection.

The project plan's tested EDM path is **source → validation/transformation → typed canonical record → governed ownership/classification → quality results / reporting**. These checks provide evidence for selected controls relevant to [OWASP ASVS](https://asvs.owasp.org/), rather than a full ASVS-level assessment.

## Browser and standards limitations

The browser automation tool returned **“Local browser use is disabled in Work settings.”** No attempt was made to bypass that setting. This run therefore does not claim fresh visual, keyboard, screen-reader, touch, color-contrast, or browser end-to-end verification. Existing desktop/mobile captures from the implementation review remain available but are historical evidence, not a substitute for the current run. A manual browser check remains necessary before claiming [WCAG 2.2](https://www.w3.org/TR/WCAG22/) conformance.

The application still has the previously documented MVP limits: simulated external source adapters; no deployment-specific SSO/MFA or password recovery; module/organization permissions rather than configurable per-asset/domain entitlements; process-local throttling/cache; capped synchronous imports; metadata-only retention policies; and no executed production restore/load test. Docker/hosted CI and external audit retention were not validated here. A dedicated least-privilege database role should replace owner-level runtime credentials before public production use.

No schema changes were needed, so no Neon migration, seed, status or connectivity test was repeated for this demo. Future manual quality runs on the live app will naturally use the configured Neon database; this review keeps its test workload local.
