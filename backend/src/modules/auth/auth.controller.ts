import type { PrismaClient } from "@prisma/client";
import { type RequestHandler } from "express";
import { type Config } from "../../config/env.js";
import { actor } from "../../shared/request-context.js";
import { createAuthService } from "./auth.service.js";
import { redeemRecovery } from "./recovery.service.js";
import {
  getQuestion,
  setupQuestion,
  changePassword,
} from "./security-question.service.js";
import { identity } from "../../shared/request-context.js";
export function createAuthController(db: PrismaClient, config: Config) {
  const service = createAuthService(db, config);
  const cookieOptions = {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: config.NODE_ENV === "production",
    path: "/",
  };
  const login: RequestHandler = async (req, res) => {
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
    const result = await service.login(requestInput, requestContext);
    res
      .cookie("waste_session", result.token, {
        ...cookieOptions,
        expires: result.expiresAt,
      })
      .json(result.payload);
  };
  const currentUser: RequestHandler = async (req, res) => {
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
    const result = await service.currentUser(requestInput, requestContext);
    res.json(result);
  };
  const refresh: RequestHandler = async (req, res) => {
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
    const result = await service.refresh(requestInput, requestContext);
    res
      .cookie("waste_session", result.token, {
        ...cookieOptions,
        expires: result.expiresAt,
      })
      .json(result.payload);
  };
  const logout: RequestHandler = async (req, res) => {
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
    const _result = await service.logout(requestInput, requestContext);
    res.clearCookie("waste_session", cookieOptions).status(204).end();
  };
  const recoverPassword: RequestHandler = async (req, res) => {
    await redeemRecovery(db, req.requestId, req.body);
    res.set("Cache-Control", "no-store").status(204).end();
  };
  const readQuestion: RequestHandler = async (req, res) => {
    const data = await getQuestion(db, identity(req));
    res.json({ data });
  };
  const writeQuestion: RequestHandler = async (req, res) => {
    await setupQuestion(db, identity(req), req.requestId, req.body);
    res.status(204).end();
  };
  const updatePassword: RequestHandler = async (req, res) => {
    await changePassword(db, identity(req), req.requestId, req.body);
    res.clearCookie("waste_session", cookieOptions).status(204).end();
  };
  return {
    login,
    currentUser,
    refresh,
    logout,
    recoverPassword,
    readQuestion,
    writeQuestion,
    updatePassword,
  };
}
