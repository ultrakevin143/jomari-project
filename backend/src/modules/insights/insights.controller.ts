import type { PrismaClient } from "@prisma/client";
import type { RequestHandler } from "express";
import { actor } from "../../shared/request-context.js";
import { createInsightsService } from "./insights.service.js";
export function createInsightsController(db: PrismaClient) {
  const service = createInsightsService(db);
  const getQualityTrends: RequestHandler = async (req, res) => {
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
    const result = await service.getQualityTrends(requestInput, requestContext);
    res.json(result);
  };
  const getCollectionReliability: RequestHandler = async (req, res) => {
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
    const result = await service.getCollectionReliability(
      requestInput,
      requestContext,
    );
    res.json(result);
  };
  return { getQualityTrends, getCollectionReliability };
}
