"use client";

import { type Run, type Source } from "@/features/integrations/types";
import { api, post } from "@/shared/api/client";
import { type Envelope, type Page, type User } from "@/shared/api/contracts";
import {
  Filters,
  PageHeading,
  Pager,
  QueryError,
} from "@/shared/data-display/index";
import { dateTime, label, number } from "@/shared/lib/utils";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  Dialog,
  Empty,
  Input,
  Label,
  Loading,
  Select,
  Status,
  Table,
  Textarea,
} from "@/shared/ui/index";
import {
  ArrowRight,
  CheckCircle2,
  FileUp,
  Play,
  RefreshCw,
  RotateCcw,
  Workflow,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import useSWR, { useSWRConfig } from "swr";

export function ImportForm({
  sources,
  onComplete,
}: {
  sources: Source[];
  onComplete: (run: Run) => void;
}) {
  const [sourceId, setSourceId] = useState(sources[0]?.id ?? ""),
    [format, setFormat] = useState("csv"),
    [content, setContent] = useState(""),
    [busy, setBusy] = useState(false),
    [templateBusy, setTemplateBusy] = useState(false),
    [error, setError] = useState("");
  const source = sources.find((s) => s.id === sourceId);
  return (
    <form
      className="import-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          const result = await post<Envelope<Run>>("/integrations/imports", {
            sourceSystemId: sourceId,
            idempotencyKey: crypto.randomUUID(),
            format,
            ...(format === "csv" ? { csv: content } : {}),
          });
          onComplete(result.data);
          toast.success(
            result.data.failed
              ? `Import completed with ${result.data.failed} quarantined records.`
              : "Import completed.",
          );
        } catch (err) {
          setError(err instanceof Error ? err.message : "Import failed.");
        } finally {
          setBusy(false);
        }
      }}
    >
      {error && <Alert title="Import could not start">{error}</Alert>}
      <div className="field">
        <Label>Source system</Label>
        <Select
          label="Source system"
          value={sourceId}
          onValueChange={(value) => {
            setSourceId(value);
            setContent("");
          }}
          options={sources.map((s) => ({ value: s.id, label: s.name }))}
        />
      </div>
      <div className="import-source-info">
        <Workflow size={17} />
        <div>
          <strong>{source?.name}</strong>
          <span>
            {source ? label(source.entity) : ""} → Validate → Canonical records
            → Audit
          </span>
        </div>
      </div>
      <div className="field">
        <Label>Integration method</Label>
        <Select
          label="Integration method"
          value={format}
          onValueChange={setFormat}
          options={[
            { value: "csv", label: "CSV batch import" },
            { value: "mock", label: "Mock REST adapter (synthetic)" },
          ]}
        />
      </div>
      {format === "csv" ? (
        <>
          <div className="import-toolbar">
            <Label htmlFor="csv-content">CSV records</Label>
            <Button
              variant="outline"
              size="sm"
              type="button"
              disabled={templateBusy}
              onClick={async () => {
                if (!source) return;
                setTemplateBusy(true);
                try {
                  const template = await api<
                    Envelope<Record<string, unknown>[]>
                  >(`/operations/templates/${source.entity}`);
                  const keys = Object.keys(template.data[0]);
                  const escape = (value: unknown) =>
                    `"${String(value ?? "").replaceAll('"', '""')}"`;
                  setContent(
                    [
                      keys.join(","),
                      ...template.data.map((row) =>
                        keys.map((k) => escape(row[k])).join(","),
                      ),
                    ].join("\n"),
                  );
                } catch (err) {
                  toast.error(
                    err instanceof Error
                      ? err.message
                      : "Template could not load.",
                  );
                } finally {
                  setTemplateBusy(false);
                }
              }}
            >
              {templateBusy ? "Loading…" : "Load valid sample"}
            </Button>
          </div>
          <Textarea
            id="csv-content"
            className="code-input"
            required
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Load a valid sample to see the required column headers."
            rows={8}
          />
          <div className="field">
            <Label htmlFor="csv-file">Or choose a CSV file (up to 1 MB)</Label>
            <Input
              id="csv-file"
              type="file"
              accept=".csv,text/csv"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  if (file.size > 1000000) {
                    toast.error("Choose a CSV file smaller than 1 MB.");
                    return;
                  }
                  setContent(await file.text());
                }
              }}
            />
          </div>
        </>
      ) : (
        <div className="info-note">
          <CheckCircle2 size={18} />
          <p>
            The local adapter returns a deterministic synthetic record with
            valid references. Repeated runs skip an unchanged source record.
          </p>
        </div>
      )}
      <p className="field-help">
        Maximum 500 rows. Timestamps require an explicit timezone. Failed
        records are quarantined with a reason; successful records remain loaded.
      </p>
      <div className="form-actions">
        <Button type="submit" disabled={busy || !sourceId}>
          {format === "mock" ? <Play size={15} /> : <FileUp size={15} />}
          {busy ? "Processing…" : "Start import"}
        </Button>
      </div>
    </form>
  );
}
export function RunDetail({
  id,
  user,
  onChanged,
}: {
  id: string;
  user: User;
  onChanged: () => void;
}) {
  const { data, error, isLoading, mutate } = useSWR<Envelope<Run>>(
    `/integrations/runs/${id}`,
  );
  const [busy, setBusy] = useState(false),
    [editing, setEditing] = useState<string | null>(null),
    [payload, setPayload] = useState("");
  async function retry(corrections: unknown[] = []) {
    setBusy(true);
    try {
      await post(`/integrations/runs/${id}/retry`, { corrections });
      toast.success(
        "Quarantined records rechecked. Successful records were preserved.",
      );
      setEditing(null);
      void mutate();
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Retry failed.");
    } finally {
      setBusy(false);
    }
  }
  if (isLoading) return <Loading />;
  if (error) return <QueryError error={error} retry={() => void mutate()} />;
  if (!data) return null;
  const run = data.data;
  return (
    <>
      <div className="run-summary">
        <Status value={run.status} />
        <span>{run.sourceSystem?.name}</span>
        <span>{label(run.method)}</span>
      </div>
      <div className="run-counts">
        <div>
          <strong>{number(run.processed)}</strong>
          <span>Loaded</span>
        </div>
        <div>
          <strong>{number(run.skipped)}</strong>
          <span>Unchanged / skipped</span>
        </div>
        <div>
          <strong className={run.failed ? "warning-text" : ""}>
            {number(run.failed)}
          </strong>
          <span>Quarantined</span>
        </div>
      </div>
      <dl className="mini-details">
        <div>
          <dt>Started</dt>
          <dd>{dateTime(run.startedAt)}</dd>
        </div>
        <div>
          <dt>Finished</dt>
          <dd>{dateTime(run.finishedAt)}</dd>
        </div>
        <div>
          <dt>Initiated by</dt>
          <dd>{run.initiatedBy}</dd>
        </div>
        <div>
          <dt>Run ID</dt>
          <dd className="mono">{run.id}</dd>
        </div>
      </dl>
      <div className="section-heading">
        <h3>Record errors</h3>
        {user.permissions.includes("integrations:write") && run.failed > 0 && (
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void retry()}
          >
            <RotateCcw size={14} />
            {busy ? "Retrying…" : "Retry unresolved"}
          </Button>
        )}
      </div>
      {run.errors?.length ? (
        run.errors.map((error) => (
          <div key={error.id} className="quarantine-item">
            <div className="quarantine-header">
              <strong>
                Row {error.rawRecord.rowNumber} ·{" "}
                {error.rawRecord.sourceRecordId || "Missing source ID"}
              </strong>
              <Status value={error.remediation} />
            </div>
            <p className="error-message">{error.message}</p>
            <small>
              {error.code} · {error.attempts} retry attempts
            </small>
            {editing === error.id ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  try {
                    const parsed: unknown = JSON.parse(payload);
                    if (
                      !parsed ||
                      Array.isArray(parsed) ||
                      typeof parsed !== "object"
                    )
                      throw new Error("Payload must be a JSON object.");
                    void retry([{ errorId: error.id, payload: parsed }]);
                  } catch (err) {
                    toast.error(
                      err instanceof Error ? err.message : "Invalid JSON.",
                    );
                  }
                }}
              >
                <Label htmlFor="corrected-payload">
                  Corrected canonical payload
                </Label>
                <Textarea
                  id="corrected-payload"
                  rows={11}
                  className="code-input"
                  value={payload}
                  onChange={(e) => setPayload(e.target.value)}
                />
                <div className="form-actions">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditing(null)}
                  >
                    Cancel
                  </Button>
                  <Button size="sm" disabled={busy}>
                    Save correction & retry row
                  </Button>
                </div>
              </form>
            ) : (
              user.permissions.includes("integrations:write") &&
              error.remediation !== "RESOLVED" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditing(error.id);
                    setPayload(
                      JSON.stringify(error.rawRecord.payload, null, 2),
                    );
                  }}
                >
                  Correct record
                </Button>
              )
            )}
          </div>
        ))
      ) : (
        <Empty title="No quarantined records">
          Every record passed validation or was skipped because its source
          version was unchanged.
        </Empty>
      )}
    </>
  );
}
export function IntegrationsView({ user }: { user: User }) {
  const { mutate: globalMutate } = useSWRConfig();
  const [page, setPage] = useState(1),
    [status, setStatus] = useState("ALL"),
    [search, setSearch] = useState(""),
    [sort, setSort] = useState("desc"),
    [importOpen, setImportOpen] = useState(false),
    [selected, setSelected] = useState<string | null>(null);
  const sources = useSWR<Envelope<Source[]>>("/integrations/sources"),
    runs = useSWR<Page<Run>>(
      `/integrations/runs?page=${page}&pageSize=8&search=${encodeURIComponent(search)}&sort=${sort}${status !== "ALL" ? `&status=${status}` : ""}`,
    );
  function refresh() {
    void sources.mutate();
    void runs.mutate();
    void globalMutate(
      (key) =>
        typeof key === "string" &&
        (key.startsWith("/overview") || key.startsWith("/operations/")),
      undefined,
      { revalidate: false },
    );
  }
  return (
    <>
      <PageHeading
        title="Integration monitor"
        description="Keep imports traceable. Quarantine bad records. Replay only what failed."
        action={
          <>
            <Button
              variant="outline"
              disabled={sources.isValidating || runs.isValidating}
              onClick={refresh}
            >
              <RefreshCw size={15} />
              Refresh
            </Button>
            {user.permissions.includes("integrations:write") && (
              <Button
                onClick={() => setImportOpen(true)}
                disabled={!sources.data}
              >
                <FileUp size={16} />
                New import
              </Button>
            )}
          </>
        }
      />
      <Card>
        <CardHeader>
          <div>
            <h2>Connected source systems</h2>
            <p>Local CSV and mock REST adapters · explicit runs only</p>
          </div>
          <Badge>{sources.data?.data.length ?? 0} sources</Badge>
        </CardHeader>
        {sources.isLoading ? (
          <Loading />
        ) : sources.error ? (
          <QueryError
            error={sources.error}
            retry={() => void sources.mutate()}
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Source system</th>
                <th>Domain</th>
                <th>Method</th>
                <th>Last successful import</th>
                <th>Latest run</th>
                <th className="numeric">Loaded / failed</th>
              </tr>
            </thead>
            <tbody>
              {sources.data?.data.map((source) => (
                <tr key={source.id}>
                  <td>
                    <strong>{source.name}</strong>
                    <small>
                      {source.code} · {label(source.entity)}
                    </small>
                  </td>
                  <td>{label(source.domain)}</td>
                  <td>
                    <Badge>{source.method}</Badge>
                  </td>
                  <td>
                    <span>{dateTime(source.lastSuccessAt)}</span>
                    <small>
                      Freshness window: {source.freshnessHours} hours
                    </small>
                  </td>
                  <td>
                    {source.runs[0] ? (
                      <button
                        className="record-link"
                        onClick={() => setSelected(source.runs[0].id)}
                      >
                        <Status value={source.runs[0].status} />
                      </button>
                    ) : (
                      "Never run"
                    )}
                  </td>
                  <td className="numeric">
                    {source.runs[0]
                      ? `${source.runs[0].processed} / ${source.runs[0].failed}`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      <Card className="section-card">
        <CardHeader>
          <div>
            <h2>Import history</h2>
            <p>
              Each batch has its own idempotency key, source cursor and audit
              trail.
            </p>
          </div>
        </CardHeader>
        <Filters
          search={search}
          searchLabel="Search source name"
          onSearch={(value) => {
            setSearch(value);
            setPage(1);
          }}
          status={status}
          onStatus={(value) => {
            setStatus(value);
            setPage(1);
          }}
          statuses={["SUCCEEDED", "PARTIAL", "FAILED", "RUNNING"]}
          sort={sort}
          onSort={() => {
            setSort(sort === "desc" ? "asc" : "desc");
            setPage(1);
          }}
        />
        {runs.isLoading ? (
          <Loading />
        ) : runs.error ? (
          <QueryError error={runs.error} retry={() => void runs.mutate()} />
        ) : runs.data?.data.length ? (
          <>
            <Table>
              <thead>
                <tr>
                  <th>Source / entity</th>
                  <th>Started</th>
                  <th>Status</th>
                  <th className="numeric">Duration</th>
                  <th className="numeric">Loaded</th>
                  <th className="numeric">Skipped</th>
                  <th className="numeric">Failed</th>
                  <th>
                    <span className="sr-only">Details</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {runs.data.data.map((run) => (
                  <tr key={run.id}>
                    <td>
                      <button
                        className="record-link"
                        onClick={() => setSelected(run.id)}
                      >
                        {run.sourceSystem?.name}
                      </button>
                      <small>
                        {label(run.entity)} · {label(run.method)}
                      </small>
                    </td>
                    <td>{dateTime(run.startedAt)}</td>
                    <td>
                      <Status value={run.status} />
                    </td>
                    <td className="numeric">
                      {run.finishedAt
                        ? `${number((new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000, 1)} s`
                        : "Running"}
                    </td>
                    <td className="numeric">{number(run.processed)}</td>
                    <td className="numeric">{number(run.skipped)}</td>
                    <td
                      className={`numeric ${run.failed ? "warning-text" : ""}`}
                    >
                      {number(run.failed)}
                    </td>
                    <td>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Inspect import ${run.id}`}
                        onClick={() => setSelected(run.id)}
                      >
                        <ArrowRight size={16} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pager pagination={runs.data.pagination} onPage={setPage} />
          </>
        ) : (
          <Empty title="No matching import runs">
            Start an import or change the status filter.
          </Empty>
        )}
      </Card>
      <Dialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Import source data"
        description="Validate a CSV batch or run a local synthetic REST adapter."
        wide
      >
        {sources.data && (
          <ImportForm
            sources={sources.data.data}
            onComplete={(run) => {
              setImportOpen(false);
              setSelected(run.id);
              refresh();
            }}
          />
        )}
      </Dialog>
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title="Import run detail"
        description="Review loaded records and correct quarantined data without replaying successful rows."
        wide
      >
        {selected && (
          <RunDetail id={selected} user={user} onChanged={refresh} />
        )}
      </Dialog>
    </>
  );
}
