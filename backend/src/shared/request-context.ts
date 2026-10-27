import type { Request } from "express";
import { ApiError } from "./errors.js";

export type Identity = {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  role: string;
  roleCode: string;
  permissions: string[];
  sessionId: string;
};
declare global {
  namespace Express {
    interface Request {
      identity?: Identity;
      requestId: string;
    }
  }
}
export function identity(req: Request): Identity {
  if (!req.identity)
    throw new ApiError(401, "UNAUTHENTICATED", "Sign in to continue.");
  return req.identity;
}
export const actor = (req: Request) => {
  const user = identity(req);
  return {
    organizationId: user.organizationId,
    actorId: user.id,
    actorName: user.name,
    requestId: req.requestId,
  };
};
