import type { PrismaClient } from "@prisma/client";
import type { RequestHandler } from "express";
import { actor } from "../../shared/request-context.js";
import { createQualityService } from "./quality.service.js";
export function createQualityController(db: PrismaClient) {
  const service = createQualityService(db);
  const getRules: RequestHandler = async (req, res) => {
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
    const result = await service.getRules(requestInput, requestContext);
    res.json(result);
  };
  const getRuns: RequestHandler = async (req, res) => {
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
    const result = await service.getRuns(requestInput, requestContext);
    res.json(result);
  };
  const getScorecards: RequestHandler = async (req, res) => {
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
    const result = await service.getScorecards(requestInput, requestContext);
    res.json(result);
  };
  const postRuns: RequestHandler = async (req, res) => {
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
    const result = await service.postRuns(requestInput, requestContext);
    res.status(201).json(result);
  };
  const patchResultsId: RequestHandler = async (req, res) => {
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
    const result = await service.patchResultsId(requestInput, requestContext);
    res.json(result);
  };
  return { getRules, getRuns, getScorecards, postRuns, patchResultsId };
}
