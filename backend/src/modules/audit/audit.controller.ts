import { type PrismaClient } from "@prisma/client";
import type { RequestHandler } from "express";
import { actor } from "../../shared/request-context.js";
import { createAuditService } from "./audit.service.js";
export function createAuditController(db: PrismaClient) {
  const service = createAuditService(db);
  const getIndex: RequestHandler = async (req, res) => {
    const requestInput = {
      body: req.body,
      query: req.query,
      params: req.params,
    };
    const requestContext = {
      user: req.identity,
      requestId: req.requestId,
      audit: () => actor(req),
    };
    const result = await service.getIndex(requestInput, requestContext);
    res.json(result);
  };
  return { getIndex };
}
