"use client";

import { useState } from "react";
import { api } from "@/shared/api/client";
import { Button } from "@/shared/ui/index";

type Preview = {
  data: {
    count: number;
    cutoff: string;
    retentionDays: number;
    records: { id: string; runId: string; createdAt: string; status: string }[];
  };
};

export function RetentionPreview({ assetId }: { assetId: string }) {
  const [preview, setPreview] = useState<Preview["data"] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function load() {
    setBusy(true);
    setError("");
    try {
      const response = await api<Preview>(
        `/governance/assets/${assetId}/retention-preview`,
      );
      setPreview(response.data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to review retention.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Retention review">
      <h3>Retention review</h3>
      <p>
        Review raw import records older than the current asset policy. Confirm
        legal holds and unresolved issues before any further action.
      </p>
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        onClick={() => void load()}
      >
        {busy ? "Checking…" : "Preview candidates"}
      </Button>
      {error && <p role="alert">{error}</p>}
      {preview && (
        <div role="status">
          <p>
            {preview.count} candidates older than{" "}
            {new Date(preview.cutoff).toLocaleDateString()} (
            {preview.retentionDays} days). Showing up to 50; no records were
            changed.
          </p>
          {preview.records.length > 0 && (
            <ul>
              {preview.records.map((record) => (
                <li key={record.id}>
                  {new Date(record.createdAt).toLocaleDateString()} ·{" "}
                  {record.status} · {record.id}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
