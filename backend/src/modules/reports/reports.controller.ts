import type { PrismaClient } from "@prisma/client";
import type { RequestHandler } from "express";
import { actor } from "../../shared/request-context.js";
import { createReportsService } from "./reports.service.js";
export function createReportsController(db: PrismaClient, demoMode: boolean) {
  const service = createReportsService(db, demoMode);
  const getOverview: RequestHandler = async (req, res) => {
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
    const result = await service.getOverview(requestInput, requestContext);
    res.json(result);
  };
  const getReportsReport: RequestHandler = async (req, res) => {
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
    const result = await service.getReportsReport(requestInput, requestContext);
    if (result.kind === "download") {
      res.setHeader("Content-Disposition", result.disposition);
      res.type("text/csv").send(result.content);
    } else res.json(result.payload);
  };
  return { getOverview, getReportsReport };
}
