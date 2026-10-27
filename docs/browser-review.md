# Mercado Chrome verification — 27 October 2026

The built-in browser connector remained disabled, so the user authorized testing in Mercado Chrome. The desktop Computer Use interface operated the existing Chrome profile through visible controls. The local demo was `http://localhost:3100`, API 4100, backed by local PostgreSQL only.

## Completed browser checks

| Check                    | Observed result                                                                                                                                                                                                   |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Administrator login      | Existing private local credentials opened the operational overview. The browser password-saving prompt was dismissed without saving.                                                                              |
| Overview                 | Canonical collection, missed-stop, received-weight and quality values rendered with charts and source freshness.                                                                                                  |
| Explicit DQM execution   | One browser-triggered run completed and saved: 931 passed observations out of 934, with 3 findings. The displayed rounded score was 99.7%; exact trend value was 99.68%.                                          |
| Quality history          | The new completed run appeared in the chart and exact-value history.                                                                                                                                              |
| Rule catalog             | Rule names and explanatory descriptions rendered as readable content.                                                                                                                                             |
| Failure sample           | Operational outliers showed the affected record identifier and “Route duration is outside configured bounds.” The investigation form used a plain-text reason field. No raw JSON sample was displayed.            |
| Governance               | Catalog, accountable owners, stewards, confidentiality, retention metadata and source-to-output lineage loaded. The policy form exposed the reason and version-control explanation; it was closed without saving. |
| CSV import               | The import modal and “Load valid sample” control worked; the sample populated CSV headers and a synthetic row. The modal was closed without importing.                                                            |
| Collection reliability   | Scheduled routes/stops, completed/missed stops, overdue routes and source-evidence caveats loaded.                                                                                                                |
| Account list             | All four existing role accounts loaded. No account was created, changed or deactivated.                                                                                                                           |
| Logout                   | The sign-out control returned the application to `/login`.                                                                                                                                                        |
| Signed-out direct access | Navigating directly to `/users` still displayed the sign-in form rather than the account list.                                                                                                                    |

## Laptop-height defect and fix

At a 1366 × 720 browser-window size, the full administrator navigation pushed the sidebar footer and sign-out control below the visible window. The fixed sidebar did not provide a usable scroll area for those controls.

Added `min-height: 0` and `overflow-y: auto` to `.sidebar nav` in `frontend/app/globals.css`. Navigation now scrolls within the sidebar while the API-reference/account footer remains reachable. Chrome inspection confirmed the visible footer, and clicking Sign out succeeded. A narrower window also rendered the signed-out responsive login and kept the direct-users URL gated.

The previous CSS was preserved privately in `.local/browser-sidebar-before.css`. A comparison verified that only these two declarations changed before updating the CSS digest in `backend/tests/architecture/baseline.json`. Route, schema and migration baselines were not changed.

Post-fix architecture checks, full lint, TypeScript and API/Next.js production builds passed. Logs are in ignored `.local/browser-review-*.txt`. Earlier local unit/integration results remain 11 and 35 passed; those database suites were not repeated for a two-declaration layout fix.

## Scope and remaining limits

This is a bounded desktop browser walkthrough, not exhaustive coverage of every control, role, browser engine or device. Permission-bypass, tenant, mutation and export behavior have separate automated local coverage. Policy/import forms were inspected and canceled; they were not submitted during this browser pass. No claim is made about live Neon rendering or live external providers.

The only browser-triggered data changes were local sign-in/logout audit/session activity and one explicit DQM run. Credentials, accounts, operational records and policies were preserved; no Neon request or remote migration occurred. Browser interactions were inspected live; no persistent screenshot files were captured for this report.
