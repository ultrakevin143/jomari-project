import { type PrismaClient } from "@prisma/client";
import type { RequestHandler } from "express";
import { actor } from "../../shared/request-context.js";
import { createIntegrationsService } from "./integrations.service.js";
export function createIntegrationsController(db: PrismaClient) {
  const service = createIntegrationsService(db);
  const getSources: RequestHandler = async (req, res) => {
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
    const result = await service.getSources(requestInput, requestContext);
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
  const getRunsId: RequestHandler = async (req, res) => {
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
    const result = await service.getRunsId(requestInput, requestContext);
    res.json(result);
  };
  const getErrors: RequestHandler = async (req, res) => {
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
    const result = await service.getErrors(requestInput, requestContext);
    res.json(result);
  };
  const postImports: RequestHandler = async (req, res) => {
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
    const result = await service.postImports(requestInput, requestContext);
    res.status(201).json(result);
  };
  const postRunsIdRetry: RequestHandler = async (req, res) => {
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
    const result = await service.postRunsIdRetry(requestInput, requestContext);
    res.json(result);
  };
  return {
    getSources,
    getRuns,
    getRunsId,
    getErrors,
    postImports,
    postRunsIdRetry,
  };
}
