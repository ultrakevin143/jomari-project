import type { PrismaClient } from "@prisma/client";
import type { RequestHandler } from "express";
import { actor } from "../../shared/request-context.js";
import { createOperationsService } from "./operations.service.js";
export function createOperationsController(db: PrismaClient) {
  const service = createOperationsService(db);
  const getLookups: RequestHandler = async (req, res) => {
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
    const result = await service.getLookups(requestInput, requestContext);
    res.json(result);
  };
  const getTemplatesEntity: RequestHandler = async (req, res) => {
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
    const result = await service.getTemplatesEntity(
      requestInput,
      requestContext,
    );
    res.json(result);
  };
  const getEntity: RequestHandler = async (req, res) => {
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
    const result = await service.getEntity(requestInput, requestContext);
    res.json(result);
  };
  const getEntityId: RequestHandler = async (req, res) => {
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
    const result = await service.getEntityId(requestInput, requestContext);
    res.json(result);
  };
  const postEntityIdArchive: RequestHandler = async (req, res) => {
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
    const result = await service.postEntityIdArchive(
      requestInput,
      requestContext,
    );
    res.json(result);
  };
  return {
    getLookups,
    getTemplatesEntity,
    getEntity,
    getEntityId,
    postEntityIdArchive,
  };
}
