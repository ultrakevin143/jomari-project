import type { PrismaClient } from "@prisma/client";
import type { RequestHandler } from "express";
import { actor } from "../../shared/request-context.js";
import { createUsersService } from "./users.service.js";
import { issueRecovery } from "../auth/recovery.service.js";
import { identity } from "../../shared/request-context.js";
import { adminResetQuestion } from "../auth/security-question.service.js";
export function createUsersController(db: PrismaClient) {
  const service = createUsersService(db);
  const listRoles: RequestHandler = async (req, res) => {
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
    const result = await service.listRoles(requestInput, requestContext);
    res.json(result);
  };
  const listUsers: RequestHandler = async (req, res) => {
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
    const result = await service.listUsers(requestInput, requestContext);
    res.json(result);
  };
  const createUser: RequestHandler = async (req, res) => {
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
    const result = await service.createUser(requestInput, requestContext);
    res.status(201).json(result);
  };
  const updateUser: RequestHandler = async (req, res) => {
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
    const result = await service.updateUser(requestInput, requestContext);
    res.json(result);
  };
  const recoverPassword: RequestHandler = async (req, res) => {
    const result = await issueRecovery(
      db,
      identity(req),
      req.requestId,
      req.params.id,
      req.body,
    );
    res.set("Cache-Control", "no-store").status(201).json({ data: result });
  };
  const resetQuestion: RequestHandler = async (req, res) => {
    await adminResetQuestion(
      db,
      identity(req),
      req.requestId,
      req.params.id,
      req.body,
    );
    res.status(204).end();
  };
  return {
    listRoles,
    listUsers,
    createUser,
    updateUser,
    recoverPassword,
    resetQuestion,
  };
}
