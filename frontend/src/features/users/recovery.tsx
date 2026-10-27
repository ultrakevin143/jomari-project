"use client";

import { useState } from "react";
import { post } from "@/shared/api/client";
import { Alert, Button, Card, Input, Label } from "@/shared/ui/index";
import type { Envelope } from "@/shared/api/contracts";
import type { Account } from "./users.screen";

export function Recovery({
  account,
  close,
}: {
  account: Account;
  close: () => void;
}) {
  const [result, setResult] = useState<{
    code: string;
    expiresAt: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Card>
      <div className="page-heading">
        <div>
          <h2>Recover access for {account.name}</h2>
          <p>
            Verify the person using an established independent channel. Do not
            enter verification answers here.
          </p>
        </div>
      </div>
      {result ? (
        <div>
          <p>
            Share this code privately with the verified person. It expires at{" "}
            {new Date(result.expiresAt).toLocaleString()} and can be used once.
          </p>
          <p>
            <code>{result.code}</code>
          </p>
          <Button type="button" onClick={close}>
            Done
          </Button>
        </div>
      ) : (
        <form
          className="edit-form presentation-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const element = e.currentTarget;
            const form = new FormData(element);
            setBusy(true);
            setError("");
            try {
              const response = await post<
                Envelope<{ code: string; expiresAt: string }>
              >(`/users/${account.id}/recovery`, {
                administratorPassword: String(
                  form.get("administratorPassword"),
                ),
                verificationMethod: String(form.get("verificationMethod")),
                reason: String(form.get("reason")),
                verified: form.get("verified") === "on",
              });
              element.reset();
              setResult(response.data);
            } catch (err) {
              setError(
                err instanceof Error
                  ? err.message
                  : "Recovery could not be started.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="field">
            <Label htmlFor="recovery-admin-password">
              Your administrator password
            </Label>
            <Input
              id="recovery-admin-password"
              name="administratorPassword"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          <div className="field">
            <Label htmlFor="recovery-method">How identity was verified</Label>
            <Input
              id="recovery-method"
              name="verificationMethod"
              minLength={8}
              maxLength={120}
              required
              placeholder="For example: verified in person"
            />
          </div>
          <div className="field">
            <Label htmlFor="recovery-reason">Reason</Label>
            <Input
              id="recovery-reason"
              name="reason"
              minLength={8}
              maxLength={500}
              required
            />
          </div>
          <label>
            <input type="checkbox" name="verified" required /> I verified this
            person through a trusted channel.
          </label>
          {error && <Alert title="Recovery not started">{error}</Alert>}
          <div className="form-actions">
            <Button
              type="button"
              variant="ghost"
              onClick={close}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Checking…" : "Create recovery code"}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
