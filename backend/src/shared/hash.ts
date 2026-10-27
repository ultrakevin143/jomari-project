import { tokenHash } from "./security.js";

export function stableHash(value: unknown): string {
  const stable = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(stable)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.entries(v)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, val]) => [k, stable(val)]),
          )
        : v;
  return tokenHash(JSON.stringify(stable(value)));
}
