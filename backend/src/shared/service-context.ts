import type { AuditInput } from "./audit.js";
import { ApiError } from "./errors.js";
import type { Identity } from "./request-context.js";
export type ServiceInput = {
  body: unknown;
  query: Record<string, unknown>;
  params: Record<string, string | string[]>;
};
export type ServiceContext = {
  user?: Identity;
  requestId: string;
  audit: () => Omit<AuditInput, "action" | "entity">;
};
export function requireIdentity(user: Identity | undefined): Identity {
  if (!user) throw new ApiError(401, "UNAUTHENTICATED", "Sign in to continue.");
  return user;
}
export const serviceAudit = (get: ServiceContext["audit"]) => get();
