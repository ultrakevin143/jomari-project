// The database grants are the source of individual permissions. This role
// policy limits those grants to the pages and actions assigned to each role.
const rolePermissions: Record<string, readonly string[]> = {
  admin: [
    "operations:read",
    "operations:write",
    "integrations:read",
    "integrations:write",
    "dq:read",
    "dq:write",
    "governance:read",
    "governance:write",
    "audit:read",
    "reports:read",
    "overview:read",
  ],
  operator: [
    "operations:read",
    "integrations:read",
    "integrations:write",
    "dq:read",
    "dq:write",
    "overview:read",
  ],
  steward: [
    "dq:read",
    "dq:write",
    "governance:read",
    "governance:write",
    "audit:read",
    "overview:read",
  ],
  analyst: ["operations:read", "reports:read", "overview:read"],
};

export function effectivePermissions(
  roleCode: string,
  granted: string[],
): string[] {
  const allowed = rolePermissions[roleCode] ?? [];
  const permissions = granted.filter((permission) =>
    allowed.includes(permission),
  );
  // Existing installations already grant operations:read to overview users.
  if (
    granted.includes("operations:read") &&
    allowed.includes("overview:read")
  ) {
    permissions.push("overview:read");
  }
  return permissions;
}
