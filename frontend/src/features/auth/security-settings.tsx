"use client";

import { useState } from "react";
import useSWR from "swr";
import { api, post } from "@/shared/api/client";
import type { Envelope } from "@/shared/api/contracts";
import { Alert, Button, Card, Input, Label } from "@/shared/ui/index";

export function SecuritySettings({
  close,
  signedOut,
}: {
  close: () => void;
  signedOut: () => void;
}) {
  const {
    data,
    error: loadError,
    isLoading,
    mutate,
  } = useSWR<Envelope<{ question: string } | null>>("/auth/security-question");
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  if (isLoading)
    return (
      <Card>
        <p>Loading security settings…</p>
      </Card>
    );
  if (loadError)
    return (
      <Card>
        <Alert title="Could not load security settings">
          {loadError.message}
        </Alert>
        <Button onClick={() => void mutate()}>Try again</Button>
        <Button variant="ghost" onClick={close}>
          Close
        </Button>
      </Card>
    );
  const existing = data?.data;
  return (
    <Card>
      <div className="page-heading">
        <div>
          <h1>Security settings</h1>
          <p>
            Set a question before changing your password. Answers are
            case-insensitive. Avoid answers others can easily find.
          </p>
        </div>
        <Button variant="ghost" onClick={close}>
          Close
        </Button>
      </div>
      {notice && <p role="status">{notice}</p>}
      {error && <Alert title="Could not save">{error}</Alert>}
      <h2>
        {existing
          ? "Update your security question"
          : "Set your security question"}
      </h2>
      <form
        className="edit-form presentation-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const element = e.currentTarget,
            form = new FormData(element);
          setError("");
          setNotice("");
          setBusy(true);
          try {
            await api("/auth/security-question", {
              method: "PUT",
              body: JSON.stringify({
                currentPassword: String(form.get("currentPassword")),
                question: String(form.get("question")),
                answer: String(form.get("answer")),
                ...(existing
                  ? { currentAnswer: String(form.get("currentAnswer")) }
                  : {}),
              }),
            });
            element.reset();
            await mutate();
            setNotice("Security question saved.");
          } catch (err) {
            setError(
              err instanceof Error ? err.message : "Unable to save question.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="field">
          <Label htmlFor="sq-password">Current password</Label>
          <Input
            id="sq-password"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        {existing && (
          <div className="field">
            <Label htmlFor="sq-current">Current answer</Label>
            <Input
              id="sq-current"
              name="currentAnswer"
              type="password"
              autoComplete="off"
              minLength={3}
              maxLength={128}
              required
            />
          </div>
        )}
        <div className="field">
          <Label htmlFor="sq-question">Question</Label>
          <Input
            id="sq-question"
            name="question"
            minLength={8}
            maxLength={180}
            defaultValue={existing?.question}
            required
          />
        </div>
        <div className="field">
          <Label htmlFor="sq-answer">New answer</Label>
          <Input
            id="sq-answer"
            name="answer"
            type="password"
            autoComplete="off"
            minLength={3}
            maxLength={128}
            required
          />
        </div>
        <Button type="submit" disabled={busy}>
          Save question
        </Button>
      </form>
      <h2>Change password</h2>
      {!existing ? (
        <p>
          Set your security question first. If you cannot verify your answer,
          ask an administrator for help.
        </p>
      ) : (
        <form
          className="edit-form presentation-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const element = e.currentTarget,
              form = new FormData(element);
            setError("");
            setBusy(true);
            try {
              await post("/auth/change-password", {
                currentPassword: String(form.get("currentPassword")),
                newPassword: String(form.get("newPassword")),
                answer: String(form.get("answer")),
              });
              element.reset();
              signedOut();
            } catch (err) {
              setError(
                err instanceof Error
                  ? err.message
                  : "Unable to change password.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <p>{existing.question}</p>
          <div className="field">
            <Label htmlFor="change-password-current">Current password</Label>
            <Input
              id="change-password-current"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          <div className="field">
            <Label htmlFor="change-password-answer">Security answer</Label>
            <Input
              id="change-password-answer"
              name="answer"
              type="password"
              autoComplete="off"
              minLength={3}
              maxLength={128}
              required
            />
          </div>
          <div className="field">
            <Label htmlFor="change-password-new">New password</Label>
            <Input
              id="change-password-new"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
          </div>
          <p>Changing your password signs you out of all sessions.</p>
          <Button type="submit" disabled={busy}>
            Change password
          </Button>
        </form>
      )}
    </Card>
  );
}
