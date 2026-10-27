import { type PrismaClient } from "@prisma/client";
import type { RequestHandler } from "express";
import { actor } from "../../shared/request-context.js";
import { createGovernanceService } from "./governance.service.js";
export function createGovernanceController(db: PrismaClient) {
  const service = createGovernanceService(db);
  const getDomains: RequestHandler = async (req, res) => {
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
    const result = await service.getDomains(requestInput, requestContext);
    res.json(result);
  };
  const getAssets: RequestHandler = async (req, res) => {
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
    const result = await service.getAssets(requestInput, requestContext);
    res.json(result);
  };
  const patchAssetsId: RequestHandler = async (req, res) => {
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
    const result = await service.patchAssetsId(requestInput, requestContext);
    res.json(result);
  };
  return { getDomains, getAssets, patchAssetsId };
}
