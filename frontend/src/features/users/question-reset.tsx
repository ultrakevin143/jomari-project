"use client";
import { useState } from "react";
import { api } from "@/shared/api/client";
import { Alert, Button, Card, Input, Label } from "@/shared/ui/index";
import type { Account } from "./users.screen";

export function QuestionReset({
  account,
  close,
}: {
  account: Account;
  close: () => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Card>
      <h2>Reset security question for {account.name}</h2>
      <p>
        Verify the person through a trusted channel first. Agree on a new answer
        privately; do not put verification answers in the reason or method.
      </p>
      <form
        className="edit-form presentation-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const element = e.currentTarget,
            form = new FormData(element);
          setBusy(true);
          setError("");
          try {
            await api(`/users/${account.id}/security-question`, {
              method: "PUT",
              body: JSON.stringify({
                administratorPassword: String(
                  form.get("administratorPassword"),
                ),
                verificationMethod: String(form.get("verificationMethod")),
                reason: String(form.get("reason")),
                verified: form.get("verified") === "on",
                question: String(form.get("question")),
                answer: String(form.get("answer")),
              }),
            });
            element.reset();
            close();
          } catch (err) {
            setError(
              err instanceof Error ? err.message : "Unable to reset question.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="field">
          <Label htmlFor="reset-admin-password">
            Your administrator password
          </Label>
          <Input
            id="reset-admin-password"
            name="administratorPassword"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        <div className="field">
          <Label htmlFor="reset-method">How identity was verified</Label>
          <Input
            id="reset-method"
            name="verificationMethod"
            minLength={8}
            maxLength={120}
            required
          />
        </div>
        <div className="field">
          <Label htmlFor="reset-reason">Reason</Label>
          <Input
            id="reset-reason"
            name="reason"
            minLength={8}
            maxLength={500}
            required
          />
        </div>
        <div className="field">
          <Label htmlFor="reset-question">New question</Label>
          <Input
            id="reset-question"
            name="question"
            minLength={8}
            maxLength={180}
            required
          />
        </div>
        <div className="field">
          <Label htmlFor="reset-answer">New answer</Label>
          <Input
            id="reset-answer"
            name="answer"
            type="password"
            autoComplete="off"
            minLength={3}
            maxLength={128}
            required
          />
        </div>
        <label>
          <input type="checkbox" name="verified" required /> I verified this
          person through a trusted channel.
        </label>
        <p>This signs the user out and invalidates unused recovery codes.</p>
        {error && <Alert title="Question not reset">{error}</Alert>}
        <div className="form-actions">
          <Button type="button" variant="ghost" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            Reset question
          </Button>
        </div>
      </form>
    </Card>
  );
}
