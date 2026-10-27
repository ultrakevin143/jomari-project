# API contract and permissions

The browser uses `/api`; Express routes omit that prefix. Complete OpenAPI 3.1: `/api/openapi.json`. Documentation landing: `/api/docs`. Sessions use an HTTP-only, SameSite=Strict cookie; HTTPS deployments mark it Secure. POST/PATCH requests use `application/json`. Supplied browser origins must exactly match `WEB_ORIGIN`. Unknown fields are rejected on mutation bodies. IDs are UUIDs.

Successful resource responses use `{ "data": ... }`. Paginated responses also include `{ "pagination": { "page": 1, "pageSize": 10, "total": 56, "pages": 6 } }`. Lists accept `page`, `pageSize` (max 100), `search`, and `sort=asc|desc`. Operational search matches source record IDs; governance search matches asset names; import search matches source names; audit search matches action/actor. Each list's sort field is documented in OpenAPI and the screen.

Errors use:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Check the highlighted request fields.",
    "requestId": "uuid",
    "details": [{ "field": "sourceSystemId", "message": "Invalid UUID" }]
  }
}
```

HTTP codes: 400 invalid JSON, 401 unauthenticated, 403 missing permission/origin, 404 missing or other-organization resource, 409 concurrency/idempotency/version conflict, 413 request too large, 415 invalid media type, 422 validation failure, 429 rate limit, 500 safe internal failure, 503 database unavailable. Correlation ID appears in `x-request-id`. SQL, passwords, session cookies and request bodies are not logged.

| Permission                                              | Administrator | Operator | Steward | Analyst |
| ------------------------------------------------------- | ------------- | -------- | ------- | ------- |
| operations:read, dq:read, governance:read, reports:read | Yes           | Yes      | Yes     | Yes     |
| operations:write (archive)                              | Yes           | No       | No      | No      |
| integrations:read                                       | Yes           | Yes      | Yes     | No      |
| integrations:write                                      | Yes           | Yes      | No      | No      |
| dq:write                                                | Yes           | Yes      | Yes     | No      |
| governance:write                                        | Yes           | No       | Yes     | No      |
| audit:read                                              | Yes           | Yes      | Yes     | No      |

Every query takes organization identity from the verified session, never from the caller. Canonical foreign references are checked by organization in the API and database triggers. Citizen identity aliases are omitted from operational responses. Raw quarantine is available only to integration-reading roles, which are trusted to handle classified source payloads.

## Import formats

`POST /integrations/imports` accepts `sourceSystemId`, `idempotencyKey` (8–120 chars), `format=csv|json|mock`, optional `entity`, and either `csv` or `records`. A source only accepts entities assigned to it. CSV headers exactly match the canonical field names. UI **Load valid sample** fetches organization-valid reference IDs. `GET /operations/lookups` also supplies reference IDs. Missing or unknown fields and invalid references are quarantined per row.

All records need `sourceRecordId` and `sourceUpdatedAt`. ISO timestamps require an offset: `2026-10-26T16:00:00+08:00` or `2026-10-26T08:00:00Z`. Stored dates normalize to UTC. Numbers must be finite and non-negative; counts must be integers.

Missing/null/boolean/blank/array values cannot stand in for required numbers; numeric CSV text and explicit zero remain valid. CSV column names must be unique canonical field names. Disabled adapters are rejected individually, even when a different source adapter is enabled. On retry, a source ID already loaded successfully in that same batch remains quarantined until corrected, preventing a duplicate row from overwriting the success. The retry reads fresh run state after acquiring the source lease.

| Entity            | Additional fields                                                                                                                            |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| routes            | code, name, serviceAreaId, optional vehicleId, scheduledStops, completedStops, missedStops (default 0), scheduledAt, durationMinutes, status |
| vehicles          | registration, code, type, capacityKg, mileageKm, fuelLitres, status                                                                          |
| facilities        | code, name, type, location, dailyCapacityKg                                                                                                  |
| weighbridge       | ticketNumber, facilityId, materialTypeId, grossKg, tareKg, netKg, occurredAt                                                                 |
| recycling         | facilityId, materialTypeId, receivedKg, recoveredKg, contaminationPct, optional exceptionReason, occurredAt                                  |
| work-orders       | reference, title, optional vehicleId, assignee, priority, status, dueAt                                                                      |
| citizen-requests  | reference, category, location, citizenAlias (synthetic only), status, reportedAt, optional resolvedAt                                        |
| contracts         | reference, vendor, serviceAreaId, slaTargetPct, ratePerTonne, validUntil                                                                     |
| collection-events | routeId, vehicleId, occurredAt, status                                                                                                       |
| telemetry         | vehicleId, occurredAt, latitude, longitude, mileageKm, fuelLitres                                                                            |

Route/event status: SCHEDULED, IN_PROGRESS, COMPLETED, MISSED. Vehicle: AVAILABLE, ON_ROUTE, MAINTENANCE. Work order: OPEN, IN_PROGRESS, COMPLETED. Citizen: OPEN → ASSIGNED → RESOLVED → CLOSED, with ASSIGNED → OPEN and RESOLVED → ASSIGNED allowed; CLOSED is terminal. Severity/priority: INFO, WARNING, ERROR. Facility type: TRANSFER_STATION, RECYCLING_FACILITY, LANDFILL.

`POST /integrations/runs/:id/retry` body: `{ "corrections": [{ "errorId": "uuid", "payload": { ...completeCanonicalRecord } }] }`. Omit corrections or send an empty array to replay unresolved errors unchanged. Corrections must belong to that run. Run detail contains row numbers, validation messages and editable raw payloads.

## DQM and scoring

Rule registry lives in `apps/api/src/quality.ts`. Metadata and thresholds persist in DQRule; executable identifiers map to a closed registry, never arbitrary code. Checks cover completeness, timestamps, non-negative quantities, materials, within-batch duplicates, vehicle identifiers, event references, route status/counts, net mass, recovery balance, request transitions, source freshness, configured outliers, and governance tagging.

Score = `100 × (record-rule checks − failed checks) / record-rule checks`, rounded to two decimals. One record evaluated by two rules contributes two checks. No checks yields 100 as a baseline; the sample size is always returned. Domain scores use the same formula. Failed samples are bounded to five per rule. Remediation state is workflow metadata; a new run is required to measure whether data improved.

Quality rules read a PostgreSQL Repeatable Read snapshot so a concurrent import cannot mix versions within one scan. Organization-scoped startup locks prevent simultaneous run creation; starts, completion and execution failures create audit events. Completeness treats whitespace-only values as missing. Timestamp checks cover source-update fields across all ten canonical entity types as well as business dates; scheduled/due/contract dates may legitimately be in the future. Non-negative checks include route duration, telemetry quantities and contract rates. Vehicle identity comparisons ignore case and surrounding whitespace.

## Governance and exports

Governance updates require the full editable policy fields, expected `version`, and a reason of at least eight characters. PII assets cannot become PUBLIC or INTERNAL. A transaction updates the version and appends before/after policy metadata to audit history.

Reports take optional inclusive `from`/`to` ISO calendar dates, up to 366 days, normalized to UTC midnight boundaries. `format=csv` returns a downloadable audited report. Formula-prefixed text cells are escaped. Diversion compares recovered mass to all net weighbridge receipts; contamination is weighted by recovery received mass. Operational current-state counts, such as active work orders, are explicitly separate from period aggregates.

## School presentation API additions

GET /users and GET /users/roles require the authenticated database role code admin. Profiles omit hashes, passwords and session data. POST /users requires name (2–100), email, password (12–128), roleId and reason (8–500). PATCH /users/:id requires name, roleId, active, updatedAt and reason; cross-organization targets/roles, stale writes, self-lockout and removal of the last active administrator are rejected. Role/access changes revoke sessions. Account and audit history are retained; no invitation email is sent. USER_CREATED and USER_UPDATED record role/access metadata without credential material.

GET /insights/quality-trends?limit=12 requires dq:read; limit is 2–30. Completed SUCCEEDED and PARTIAL runs are included; execution failures and unfinished runs are excluded. Domain scores use summed observations, and changes are percentage points. No observations yields null. GET /dq/scorecards now accepts a UUID runId for organization-scoped historical inspection.

GET /insights/collection-reliability requires reports:read and operations:read. It accepts from/to (inclusive UTC dates, maximum 366 days), areaId, page/pageSize/search. Returns summary, coverage definition, area options and paginated route rows with plain-language findings. Unarchived scheduled routes form the denominator. Overdue means scheduled start plus recorded duration is past and route status is not Completed. Completed routes may validly contain missed stops if completed plus missed equals scheduled. Missing event evidence is not a scheduled-service SLA violation by itself. Search affects rows only.
