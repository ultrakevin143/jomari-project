"use client";

import { post } from "@/shared/api/client";
import { type Envelope, type User } from "@/shared/api/contracts";
import { Alert, Badge, Button, Input, Label } from "@/shared/ui/index";
import {
  ArrowRight,
  BarChart3,
  Database,
  Recycle,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";

export function Login({
  networkError,
  onLogin,
}: {
  networkError?: Error;
  onLogin: (user: Envelope<User>) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [recovering, setRecovering] = useState(false),
    [notice, setNotice] = useState("");
  return (
    <main className="login-layout">
      <section className="login-story">
        <div className="brand">
          <span className="brand-mark">
            <Recycle size={24} />
          </span>
          <div>
            Waste Hub<span>OPERATIONS DATA PLATFORM</span>
          </div>
        </div>
        <div className="login-story-body">
          <h1>
            Connected data.
            <br />
            Better collections.
          </h1>
          <p>
            A shared view of collection performance, resource recovery, and the
            data behind every decision.
          </p>
          <div className="login-flow">
            <div>
              <Database />
              <span>
                Seven source systems
                <small>Collection, fleet, materials and service</small>
              </span>
            </div>
            <div>
              <ShieldCheck />
              <span>
                One governed data layer
                <small>Validated, classified and traceable</small>
              </span>
            </div>
            <div>
              <BarChart3 />
              <span>
                Clear operational decisions
                <small>Service reliability and recovery outcomes</small>
              </span>
            </div>
          </div>
        </div>
        <div className="login-story-footer">
          Waste Operations Data Hub<span>Municipal operations</span>
        </div>
      </section>
      <section className="login-form-panel">
        <div className="login-form">
          <Badge tone="info">Workspace access</Badge>
          <h2>Sign in to Waste Hub</h2>
          <p>Use your organization account to open the operations console.</p>
          {(error || networkError) && (
            <Alert title="Could not sign in">
              {error || networkError?.message}
            </Alert>
          )}
          {notice && <p role="status">{notice}</p>}
          {recovering ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const element = e.currentTarget;
                const form = new FormData(element);
                setBusy(true);
                setError("");
                try {
                  await post("/auth/recover", {
                    code: String(form.get("code")),
                    password: String(form.get("newPassword")),
                  });
                  element.reset();
                  setRecovering(false);
                  setNotice(
                    "Password updated. Sign in with your new password.",
                  );
                } catch (err) {
                  setError(
                    err instanceof Error ? err.message : "Recovery failed.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              <p>
                Ask an administrator to verify your identity and provide a
                recovery code privately.
              </p>
              <div className="field">
                <Label htmlFor="recovery-code">Recovery code</Label>
                <Input
                  id="recovery-code"
                  name="code"
                  type="password"
                  autoComplete="off"
                  required
                />
              </div>
              <div className="field">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  name="newPassword"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  required
                />
              </div>
              <Button type="submit" disabled={busy}>
                {busy ? "Updating…" : "Set new password"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setRecovering(false);
                  setError("");
                }}
              >
                Back to sign in
              </Button>
            </form>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setError("");
                setBusy(true);
                const form = new FormData(e.currentTarget);
                try {
                  const result = await post<Envelope<User>>("/auth/login", {
                    email: form.get("email"),
                    password: form.get("password"),
                  });
                  onLogin(result);
                } catch (err) {
                  setError(
                    err instanceof Error ? err.message : "Sign-in failed.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              <div className="field">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  placeholder="you@municipality.gov"
                  required
                />
              </div>
              <div className="field">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  maxLength={128}
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Signing in…" : "Open workspace"}
                <ArrowRight size={16} />
              </Button>
            </form>
          )}
          {!recovering && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setRecovering(true);
                setError("");
                setNotice("");
              }}
            >
              Forgot password?
            </Button>
          )}
          <div className="login-note">
            <ShieldCheck size={17} />
            <p>
              Access is controlled by your role. Administrative changes are
              recorded in the audit log.
            </p>
          </div>
          <a
            className="text-link"
            href="/api/docs"
            target="_blank"
            rel="noreferrer"
          >
            API documentation <ArrowRight size={13} />
          </a>
        </div>
      </section>
    </main>
  );
}
