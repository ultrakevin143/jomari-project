export type Operation = {
  summary: string;
  tags: string[];
  security?: {
    session: never[];
  }[];
  parameters?: unknown[];
  requestBody?: unknown;
  responses: Record<string, unknown>;
};
export function openapi() {
  const paths: Record<string, Record<string, Operation>> = {};
  const success = {
    description: "Successful response",
    content: {
      "application/json": { schema: { $ref: "#/components/schemas/Envelope" } },
    },
  };
  const errors = {
    description: "Consistent error envelope",
    content: {
      "application/json": { schema: { $ref: "#/components/schemas/Error" } },
    },
  };
  const pageParams = [
    {
      name: "page",
      in: "query",
      schema: { type: "integer", minimum: 1, default: 1 },
    },
    {
      name: "pageSize",
      in: "query",
      schema: { type: "integer", minimum: 1, maximum: 100, default: 10 },
    },
    { name: "search", in: "query", schema: { type: "string", maxLength: 120 } },
    {
      name: "sort",
      in: "query",
      schema: { type: "string", enum: ["asc", "desc"], default: "desc" },
    },
  ];
  function add(
    path: string,
    method: string,
    tag: string,
    summary: string,
    body?: unknown,
    paginated = false,
    anonymous = false,
  ) {
    const parameters: unknown[] = [...path.matchAll(/\{(\w+)\}/g)].map((m) => ({
      name: m[1],
      in: "path",
      required: true,
      schema: { type: "string", ...(m[1] === "id" ? { format: "uuid" } : {}) },
    }));
    if (paginated) parameters.push(...pageParams);
    const op: Operation = {
      summary,
      tags: [tag],
      security: anonymous ? [] : [{ session: [] }],
      parameters,
      responses: {
        [(method === "post" && path.includes("imports")) ||
        (method === "post" && path === "/dq/runs") ||
        (method === "post" && path === "/users/{id}/recovery")
          ? "201"
          : path === "/auth/logout" ||
              path === "/auth/recover" ||
              path === "/auth/change-password" ||
              (method === "put" && path.includes("security-question"))
            ? "204"
            : "200"]: success,
        "401": errors,
        "403": errors,
        "404": errors,
        "409": errors,
        "422": errors,
        "429": errors,
        "500": errors,
        "503": errors,
      },
    };
    if (body)
      op.requestBody = {
        required: true,
        content: { "application/json": { schema: body } },
      };
    paths[path] ??= {};
    paths[path]![method] = op;
    return op;
  }
  const object = (
    properties: Record<string, unknown>,
    required = Object.keys(properties),
  ) => ({ type: "object", properties, required, additionalProperties: false });
  const string = { type: "string" },
    uuid = { type: "string", format: "uuid" },
    jsonRecord = { type: "object", additionalProperties: true };
  add(
    "/health",
    "get",
    "System",
    "Liveness (no database query)",
    undefined,
    false,
    true,
  );
  add(
    "/ready",
    "get",
    "System",
    "Database readiness, cached for 30 seconds",
    undefined,
    false,
    true,
  );
  add(
    "/auth/login",
    "post",
    "Authentication",
    "Sign in and issue an opaque HTTP-only session",
    object({
      email: { type: "string", format: "email" },
      password: { type: "string", maxLength: 128 },
    }),
    false,
    true,
  );
  add(
    "/auth/me",
    "get",
    "Authentication",
    "Current organization, role and permissions",
  );
  add(
    "/auth/refresh",
    "post",
    "Authentication",
    "Rotate and invalidate the previous session",
    object({}),
  );
  add(
    "/auth/logout",
    "post",
    "Authentication",
    "Invalidate the session and clear its cookie",
    object({}),
  );
  add(
    "/users",
    "get",
    "Users",
    "List workspace accounts; administrator only",
    undefined,
    true,
  );
  add(
    "/users/roles",
    "get",
    "Users",
    "List organization roles; administrator only",
  );
  add(
    "/users",
    "post",
    "Users",
    "Create account; administrator only; name, email, password (12–128), roleId and reason required",
    object({
      name: { type: "string" },
      email: { type: "string", format: "email" },
      password: { type: "string", minLength: 12, maxLength: 128 },
      roleId: { type: "string", format: "uuid" },
      reason: { type: "string", minLength: 8, maxLength: 500 },
    }),
  );
  add(
    "/users/{id}",
    "patch",
    "Users",
    "Update account; administrator only; stale edits and lockouts rejected",
    object({
      name: { type: "string" },
      roleId: { type: "string", format: "uuid" },
      active: { type: "boolean" },
      updatedAt: { type: "string", format: "date-time" },
      reason: { type: "string", minLength: 8, maxLength: 500 },
    }),
  );
  add(
    "/auth/security-question",
    "get",
    "Authentication",
    "Read your security question; the answer is never returned",
  );
  add(
    "/auth/security-question",
    "put",
    "Authentication",
    "Set a security question using your password and current answer when configured",
    object(
      {
        currentPassword: string,
        question: string,
        answer: string,
        currentAnswer: string,
      },
      ["currentPassword", "question", "answer"],
    ),
  );
  add(
    "/auth/change-password",
    "post",
    "Authentication",
    "Change password using your current password and security answer",
    object({ currentPassword: string, newPassword: string, answer: string }),
  );
  add(
    "/users/{id}/security-question",
    "put",
    "Users",
    "Administrator resets a verified user's question after reauthentication",
    object({
      administratorPassword: string,
      verificationMethod: string,
      reason: string,
      verified: { type: "boolean" },
      question: string,
      answer: string,
    }),
  );
  add(
    "/insights/quality-trends",
    "get",
    "Quality",
    "Successful quality history and weighted domain comparisons",
  );
  add(
    "/users/{id}/recovery",
    "post",
    "Users",
    "Administrator reauthenticates and records independent verification to issue a single-use recovery code",
    object({
      administratorPassword: string,
      verificationMethod: string,
      reason: string,
      verified: { type: "boolean" },
    }),
  );
  add(
    "/auth/recover",
    "post",
    "Authentication",
    "Redeem a recovery code and set a new password; revokes existing sessions",
    object({ code: string, password: string }),
    false,
    true,
  );
  add(
    "/insights/collection-reliability",
    "get",
    "Reports",
    "Inclusive UTC date/service-area collection reliability",
    undefined,
    true,
  );
  for (const entity of [
    "routes",
    "vehicles",
    "facilities",
    "weighbridge",
    "recycling",
    "work-orders",
    "citizen-requests",
    "contracts",
    "collection-events",
    "telemetry",
  ]) {
    add(
      `/operations/${entity}`,
      "get",
      "Operations",
      `Governed ${entity} list; source ID search, status filter, sourceUpdatedAt sort`,
      undefined,
      true,
    );
    add(
      `/operations/${entity}/{id}`,
      "get",
      "Operations",
      `Organization-scoped ${entity} detail`,
    );
  }
  add(
    "/operations/lookups",
    "get",
    "Operations",
    "Reference IDs for canonical imports",
  );
  add(
    "/operations/templates/{entity}",
    "get",
    "Integrations",
    "Synthetic import template with valid local reference IDs",
  );
  for (const entity of ["routes", "vehicles", "facilities"])
    add(
      `/operations/${entity}/{id}/archive`,
      "post",
      "Operations",
      "Soft archive with an audit reason",
      object({ reason: { type: "string", minLength: 8, maxLength: 500 } }),
    );
  add(
    "/integrations/sources",
    "get",
    "Integrations",
    "Seven source systems, connections and latest run",
  );
  add(
    "/integrations/imports",
    "post",
    "Integrations",
    "Import 1–500 records; source lock and idempotency key prevent duplicate loading",
    object(
      {
        sourceSystemId: uuid,
        entity: {
          type: "string",
          enum: [
            "routes",
            "vehicles",
            "facilities",
            "weighbridge",
            "recycling",
            "work-orders",
            "citizen-requests",
            "contracts",
            "collection-events",
            "telemetry",
          ],
        },
        idempotencyKey: { type: "string", minLength: 8, maxLength: 120 },
        format: { type: "string", enum: ["csv", "json", "mock"] },
        csv: { type: "string", maxLength: 1000000 },
        records: { type: "array", maxItems: 500, items: jsonRecord },
      },
      ["sourceSystemId", "idempotencyKey", "format"],
    ),
  );
  add(
    "/integrations/runs",
    "get",
    "Integrations",
    "Paginated runs, source-name search and status filter",
    undefined,
    true,
  );
  add(
    "/integrations/runs/{id}",
    "get",
    "Integrations",
    "Run detail including quarantined payloads (integration roles only)",
  );
  add(
    "/integrations/runs/{id}/retry",
    "post",
    "Integrations",
    "Retry unresolved errors only; supplied corrections select individual rows",
    object(
      {
        corrections: {
          type: "array",
          maxItems: 500,
          items: object({ errorId: uuid, payload: jsonRecord }),
        },
      },
      [],
    ),
  );
  add(
    "/integrations/errors",
    "get",
    "Integrations",
    "Paginated quarantine; status=OPEN|ACKNOWLEDGED|RESOLVED",
    undefined,
    true,
  );
  add(
    "/dq/rules",
    "get",
    "Quality",
    "Executable rule metadata and threshold configuration",
  );
  add(
    "/dq/runs",
    "post",
    "Quality",
    "Run active rules once and persist record-rule results",
    object({}),
  );
  add(
    "/dq/runs",
    "get",
    "Quality",
    "Paginated quality run history",
    undefined,
    true,
  );
  add(
    "/dq/scorecards",
    "get",
    "Quality",
    "Latest completed scorecard; optional severity filter; transparent formula",
  );
  add(
    "/dq/results/{id}",
    "patch",
    "Quality",
    "Update remediation metadata without changing observed scores",
    object({
      remediation: {
        type: "string",
        enum: ["OPEN", "ACKNOWLEDGED", "RESOLVED"],
      },
      note: { type: "string", minLength: 8, maxLength: 1000 },
    }),
  );
  add(
    "/governance/domains",
    "get",
    "Governance",
    "Domains, accountable owners and stewards",
  );
  add(
    "/governance/assets",
    "get",
    "Governance",
    "Asset catalog; search, domainId and classification filters",
    undefined,
    true,
  );
  add(
    "/governance/assets/{id}",
    "patch",
    "Governance",
    "Optimistic-versioned policy update with immutable audit event",
    object({
      owner: string,
      steward: string,
      classification: {
        type: "string",
        enum: ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"],
      },
      retentionDays: { type: "integer", minimum: 1, maximum: 36500 },
      policy: string,
      reason: { type: "string", minLength: 8 },
      version: { type: "integer", minimum: 1 },
    }),
  );
  add(
    "/audit-events",
    "get",
    "Audit",
    "Append-only audit log; actor/action search and entity filter",
    undefined,
    true,
  );
  add(
    "/overview",
    "get",
    "Reporting",
    "Aggregated operational metrics and source freshness; no polling",
  );
  for (const report of ["operations", "diversion"]) {
    const op = add(
      `/reports/${report}`,
      "get",
      "Reporting",
      `${report} report; inclusive UTC date range and audited CSV export`,
    );
    op.parameters = [
      { name: "from", in: "query", schema: { type: "string", format: "date" } },
      { name: "to", in: "query", schema: { type: "string", format: "date" } },
      {
        name: "format",
        in: "query",
        schema: { type: "string", enum: ["json", "csv"], default: "json" },
      },
    ];
    op.responses["200"] = {
      description: "Report or CSV download",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Envelope" },
        },
        "text/csv": { schema: { type: "string" } },
      },
    };
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "Waste Operations Data Hub API",
      version: "1.0.0",
      description:
        "Same-origin /api proxy in Next.js. Permission matrix and canonical CSV fields: repository docs. All requests use organization-scoped sessions. Dates require ISO 8601 offsets; normalized to UTC.",
    },
    servers: [
      { url: "/api", description: "Next.js proxy" },
      { url: "http://127.0.0.1:4000", description: "Local Express" },
    ],
    paths,
    components: {
      securitySchemes: {
        session: { type: "apiKey", in: "cookie", name: "waste_session" },
      },
      schemas: {
        Envelope: {
          type: "object",
          properties: {
            data: {},
            pagination: {
              type: "object",
              properties: {
                page: { type: "integer" },
                pageSize: { type: "integer" },
                total: { type: "integer" },
                pages: { type: "integer" },
              },
            },
          },
        },
        Error: {
          type: "object",
          required: ["error"],
          properties: {
            error: {
              type: "object",
              required: ["code", "message", "requestId"],
              properties: {
                code: { type: "string" },
                message: { type: "string" },
                requestId: { type: "string" },
                details: {},
              },
            },
          },
        },
      },
    },
  };
}
