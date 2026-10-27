"use client";

import { QualityTrends } from "@/features/quality/quality-trends";
import {
  type QualityResult,
  type QualityRule,
  type QualityRun,
} from "@/features/quality/types";
import { api, post } from "@/shared/api/client";
import { type Envelope, type Page, type User } from "@/shared/api/contracts";
import { PageHeading, QueryError } from "@/shared/data-display/index";
import { dateTime, label, number } from "@/shared/lib/utils";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Dialog,
  Empty,
  Label,
  Loading,
  Progress,
  Select,
  Status,
  Table,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@/shared/ui/index";
import {
  Activity,
  ArrowRight,
  Play,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import useSWR, { useSWRConfig } from "swr";

export function QualityView({ user }: { user: User }) {
  const [runId, setRunId] = useState("");
  const { mutate: mutateCache } = useSWRConfig();
  const [severity, setSeverity] = useState("ALL"),
    [remediation, setRemediation] = useState("ALL"),
    [tab, setTab] = useState("results"),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<QualityResult | null>(null),
    [saving, setSaving] = useState(false),
    [state, setState] = useState("ACKNOWLEDGED");
  const score = useSWR<Envelope<QualityRun | null>>(
      `/dq/scorecards${runId ? `?runId=${runId}` : ""}`,
    ),
    rules = useSWR<Envelope<QualityRule[]>>(
      tab === "rules" ? "/dq/rules" : null,
    ),
    history = useSWR<Page<QualityRun>>(
      tab === "history" ? "/dq/runs?page=1&pageSize=20" : null,
    );
  async function run() {
    setBusy(true);
    try {
      await post("/dq/runs");
      await mutateCache(
        "/dq/scorecards",
        api<Envelope<QualityRun | null>>("/dq/scorecards"),
        { revalidate: false },
      );
      setRunId("");
      await mutateCache("/insights/quality-trends", undefined, {
        revalidate: true,
      });
      await mutateCache("/dq/runs?page=1&pageSize=20", undefined, {
        revalidate: true,
      });
      toast.success("Quality run completed and results saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Quality run failed.");
    } finally {
      setBusy(false);
    }
  }
  const data = score.data?.data,
    results =
      data?.results.filter(
        (r) =>
          (severity === "ALL" || r.severity === severity) &&
          (remediation === "ALL" || r.remediation === remediation),
      ) ?? [];
  return (
    <>
      <PageHeading
        title="Data quality"
        description="Fourteen reusable checks, measured against canonical records and source metadata."
        action={
          <>
            {runId && (
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await mutateCache(
                      "/dq/scorecards",
                      api<Envelope<QualityRun | null>>("/dq/scorecards"),
                      { revalidate: false },
                    );
                    setRunId("");
                  } catch (err) {
                    toast.error(
                      err instanceof Error
                        ? err.message
                        : "Latest snapshot could not be loaded.",
                    );
                  }
                }}
              >
                Latest snapshot
              </Button>
            )}
            <Button
              variant="outline"
              disabled={score.isValidating}
              onClick={() => void score.mutate()}
            >
              <RefreshCw size={15} />
              Refresh
            </Button>
            {user.permissions.includes("dq:write") && (
              <Button disabled={busy} onClick={() => void run()}>
                <Play size={15} />
                {busy ? "Running checks…" : "Run quality checks"}
              </Button>
            )}
          </>
        }
      />
      {score.isLoading ? (
        <Loading />
      ) : score.error ? (
        <QueryError error={score.error} retry={() => void score.mutate()} />
      ) : data ? (
        <>
          <Card className="quality-summary">
            <div className="quality-score">
              <span className="quality-score-label">
                {runId ? "Selected snapshot score" : "Latest quality score"}
              </span>
              <strong>
                {number(data.score, 1)}
                <span>%</span>
              </strong>
              <Badge tone={data.failed ? "warning" : "success"}>
                {data.failed ? "Review required" : "All checks passed"}
              </Badge>
            </div>
            <div className="quality-explanation">
              <h2>
                {number(data.checked - data.failed)} checks passed out of{" "}
                {number(data.checked)}
              </h2>
              <p>{data.formula}</p>
              <span className="muted">
                Completed {dateTime(data.finishedAt)}
              </span>
            </div>
          </Card>
          <div className="domain-score-grid">
            {data.domains.map((domain) => (
              <div className="domain-score" key={domain.domain}>
                <div>
                  <strong>{domain.domain}</strong>
                  <span>{number(domain.score, 1)}%</span>
                </div>
                <Progress
                  value={domain.score}
                  label={`${domain.domain} quality score`}
                />
                <small>
                  {number(domain.failed)} failed / {number(domain.checked)}{" "}
                  checks
                </small>
              </div>
            ))}
          </div>
        </>
      ) : (
        <Card>
          <Empty title="Establish your data quality baseline">
            Run the configured checks to persist a scorecard, samples and
            remediation states.
          </Empty>
        </Card>
      )}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="trends">Quality trends</TabsTrigger>
          <TabsTrigger value="results">
            <Activity size={15} />
            Rule results
          </TabsTrigger>
          <TabsTrigger value="rules">
            <ShieldCheck size={15} />
            Rule catalog
          </TabsTrigger>
          <TabsTrigger value="history">Run history</TabsTrigger>
        </TabsList>
        <TabsContent value="results">
          <Card>
            <div className="quality-filters">
              <div>
                <h2>
                  {runId ? "Selected snapshot rules" : "Latest rule results"}
                </h2>
                <p>
                  Failed checks retain their observed score after remediation.
                </p>
              </div>
              <div className="filter-actions">
                <Select
                  label="Severity"
                  value={severity}
                  onValueChange={setSeverity}
                  options={[
                    { value: "ALL", label: "All severities" },
                    ...["ERROR", "WARNING", "INFO"].map((value) => ({
                      value,
                      label: label(value),
                    })),
                  ]}
                />
                <Select
                  label="Remediation state"
                  value={remediation}
                  onValueChange={setRemediation}
                  options={[
                    { value: "ALL", label: "All remediation states" },
                    ...["OPEN", "ACKNOWLEDGED", "RESOLVED"].map((value) => ({
                      value,
                      label: label(value),
                    })),
                  ]}
                />
              </div>
            </div>
            {results.length ? (
              <Table>
                <thead>
                  <tr>
                    <th>Quality rule</th>
                    <th>Domain</th>
                    <th>Severity</th>
                    <th className="numeric">Checked</th>
                    <th className="numeric">Failed</th>
                    <th>Remediation</th>
                    <th>
                      <span className="sr-only">Review</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result) => (
                    <tr key={result.id}>
                      <td>
                        <button
                          className="record-link"
                          onClick={() => {
                            setSelected(result);
                            setState(result.remediation);
                          }}
                        >
                          {result.rule.name}
                        </button>
                        <small className="mono">{result.rule.code}</small>
                      </td>
                      <td>{result.rule.domain}</td>
                      <td>
                        <Status value={result.severity} />
                      </td>
                      <td className="numeric">{number(result.checked)}</td>
                      <td
                        className={`numeric ${result.failed ? "warning-text" : ""}`}
                      >
                        {number(result.failed)}
                      </td>
                      <td>
                        <Status value={result.remediation} />
                      </td>
                      <td>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Review ${result.rule.name}`}
                          onClick={() => {
                            setSelected(result);
                            setState(result.remediation);
                          }}
                        >
                          <ArrowRight size={15} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <Empty title="No results match these filters">
                Choose another severity or remediation state.
              </Empty>
            )}
          </Card>
        </TabsContent>
        <TabsContent value="rules">
          <Card>
            <CardHeader>
              <div>
                <h2>Executable rule catalog</h2>
                <p>
                  Checks run server-side against a single reusable data
                  snapshot.
                </p>
              </div>
            </CardHeader>
            {rules.isLoading ? (
              <Loading />
            ) : rules.error ? (
              <QueryError
                error={rules.error}
                retry={() => void rules.mutate()}
              />
            ) : (
              <div className="rule-catalog">
                {rules.data?.data.map((rule) => (
                  <div className="rule-description" key={rule.id}>
                    <span className="rule-code mono">{rule.code}</span>
                    <div>
                      <h3>{rule.name}</h3>
                      <p>{rule.description}</p>
                      {Object.keys(rule.config).length > 0 && (
                        <small>
                          Thresholds:{" "}
                          {Object.entries(rule.config)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(" · ")}
                        </small>
                      )}
                    </div>
                    <Status value={rule.severity} />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
        <TabsContent value="trends">
          <QualityTrends
            onSelect={(id) => {
              setRunId(id);
              setTab("results");
            }}
          />
        </TabsContent>
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <div>
                <h2>Quality run history</h2>
                <p>The 20 most recent persisted runs</p>
              </div>
            </CardHeader>
            {history.isLoading ? (
              <Loading />
            ) : history.error ? (
              <QueryError
                error={history.error}
                retry={() => void history.mutate()}
              />
            ) : history.data?.data.length ? (
              <Table>
                <thead>
                  <tr>
                    <th>Completed</th>
                    <th>Status</th>
                    <th className="numeric">Score</th>
                    <th className="numeric">Checks</th>
                    <th className="numeric">Failed</th>
                  </tr>
                </thead>
                <tbody>
                  {history.data.data.map((run) => (
                    <tr key={run.id}>
                      <td>{dateTime(run.finishedAt)}</td>
                      <td>
                        <Status value={run.status} />
                      </td>
                      <td className="numeric">{number(run.score, 1)}%</td>
                      <td className="numeric">{number(run.checked)}</td>
                      <td className="numeric">{number(run.failed)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <Empty title="No quality runs yet">
                Run the configured checks to start a measured history.
              </Empty>
            )}
          </Card>
        </TabsContent>
      </Tabs>
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title={selected?.rule.name ?? "Quality result"}
        description={selected?.rule.description}
        wide
      >
        {selected && (
          <>
            <div className="run-summary">
              <Status value={selected.severity} />
              <Status value={selected.remediation} />
              <span>
                {selected.failed} failed / {selected.checked} checked
              </span>
            </div>
            <h3 className="section-title">Sample offending records</h3>
            {selected.samples.length ? (
              <div className="sample-list">
                {selected.samples.map((sample) => (
                  <div key={sample.id}>
                    <code>{sample.id}</code>
                    <p>{sample.reason}</p>
                  </div>
                ))}
              </div>
            ) : (
              <Empty title="No offending samples">
                This rule passed for the evaluated records.
              </Empty>
            )}
            {selected.remediationNote && (
              <p className="info-note">
                Latest remediation note: {selected.remediationNote}
              </p>
            )}
            {user.permissions.includes("dq:write") && (
              <form
                className="remediation-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setSaving(true);
                  try {
                    await api(`/dq/results/${selected.id}`, {
                      method: "PATCH",
                      body: JSON.stringify({
                        remediation: state,
                        note: new FormData(e.currentTarget).get("note"),
                      }),
                    });
                    setSelected(null);
                    await score.mutate();
                    toast.success(
                      "Remediation state recorded in the audit log.",
                    );
                  } catch (err) {
                    toast.error(
                      err instanceof Error ? err.message : "Update failed.",
                    );
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                <div className="field">
                  <Label>Remediation state</Label>
                  <Select
                    label="New remediation state"
                    value={state}
                    onValueChange={setState}
                    options={["OPEN", "ACKNOWLEDGED", "RESOLVED"].map(
                      (value) => ({ value, label: label(value) }),
                    )}
                  />
                </div>
                <div className="field">
                  <Label htmlFor="remediation-note">
                    Action taken / reason
                  </Label>
                  <Textarea
                    id="remediation-note"
                    name="note"
                    minLength={8}
                    maxLength={1000}
                    required
                    placeholder="Describe the investigation, correction, or accepted exception."
                  />
                </div>
                <div className="form-actions">
                  <Button disabled={saving}>
                    {saving ? "Saving…" : "Record remediation"}
                  </Button>
                </div>
              </form>
            )}
          </>
        )}
      </Dialog>
    </>
  );
}
