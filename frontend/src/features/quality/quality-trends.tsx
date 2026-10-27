"use client";

import { type Envelope } from "@/shared/api/contracts";
import { Refresh, State } from "@/shared/data-display/index";
import { dateTime, number } from "@/shared/lib/utils";
import { Button, Card, CardHeader, Empty, Table } from "@/shared/ui/index";
import useSWR from "swr";

export type Run = {
  id: string;
  startedAt: string;
  checked: number;
  failed: number;
  score: number | null;
};
export type Domain = {
  domain: string;
  checked: number;
  failed: number;
  score: number | null;
  previousScore: number | null;
  change: number | null;
};
export type Trends = {
  runs: Run[];
  domains: Domain[];
  formula: string;
};
export function QualityTrends({
  onSelect,
}: {
  onSelect: (id: string) => void;
}) {
  const { data, error, isLoading, mutate } = useSWR<Envelope<Trends>>(
      "/insights/quality-trends",
    ),
    d = data?.data,
    points = d?.runs.filter((r) => r.score !== null) ?? [];
  const x = (i: number) => 60 + (i * 610) / Math.max(1, points.length - 1),
    y = (score: number) => 180 - score * 1.5;
  return (
    <Card>
      <CardHeader>
        <div>
          <h2>Quality over time</h2>
          <p>
            Last 12 completed snapshots, including evaluations with findings.
            Execution failures are excluded. Select a run to inspect its checks.
          </p>
        </div>
        <Refresh refresh={() => mutate()} />
      </CardHeader>
      <State loading={isLoading} error={error} retry={() => mutate()}>
        {d && (
          <>
            <p className="formula quality-trend-note">{d.formula}</p>
            {points.length > 1 ? (
              <div
                className="quality-chart"
                role="region"
                aria-label="Scrollable quality history chart"
                tabIndex={0}
              >
                <svg
                  viewBox="0 0 720 230"
                  role="img"
                  aria-label="Quality score from zero to 100 percent across completed runs; exact timestamps and scores are in the following table"
                >
                  <title>Quality score history</title>
                  {[0, 50, 100].map((v) => (
                    <g key={v}>
                      <line
                        x1="60"
                        x2="670"
                        y1={y(v)}
                        y2={y(v)}
                        className="chart-grid"
                      />
                      <text x="8" y={y(v) + 5}>
                        {v}%
                      </text>
                    </g>
                  ))}
                  <polyline
                    points={points
                      .map((r, i) => `${x(i)},${y(r.score!)}`)
                      .join(" ")}
                    className="chart-series"
                  />
                  {points.map((r, i) => (
                    <circle
                      key={r.id}
                      cx={x(i)}
                      cy={y(r.score!)}
                      r="4"
                      className="chart-point"
                    />
                  ))}
                  <text x="60" y="215">
                    {dateTime(points[0]!.startedAt)}
                  </text>
                  <text x="670" y="215" textAnchor="end">
                    {dateTime(points.at(-1)!.startedAt)}
                  </text>
                </svg>
              </div>
            ) : (
              <Empty
                title={
                  points.length
                    ? "First quality baseline"
                    : "No completed snapshots"
                }
              >
                {points.length
                  ? "Run checks again after correcting data to compare real results. No example history is added."
                  : "Run quality checks to establish a baseline."}
              </Empty>
            )}
            <Table>
              <thead>
                <tr>
                  <th>Completed run (UTC)</th>
                  <th className="numeric">Checked</th>
                  <th className="numeric">Failed</th>
                  <th className="numeric">Score</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {d.runs.map((r) => (
                  <tr key={r.id}>
                    <td>{dateTime(r.startedAt)}</td>
                    <td className="numeric">{number(r.checked)}</td>
                    <td className="numeric">{number(r.failed)}</td>
                    <td className="numeric">
                      {r.score === null
                        ? "No observations"
                        : `${number(r.score, 2)}%`}
                    </td>
                    <td>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onSelect(r.id)}
                      >
                        Inspect run
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <CardHeader>
              <div>
                <h3>Latest snapshot by domain</h3>
                <p>
                  Changes compare the two latest completed snapshots. Different
                  coverage can change a score.
                </p>
              </div>
            </CardHeader>
            <Table>
              <thead>
                <tr>
                  <th>Domain</th>
                  <th className="numeric">Checked</th>
                  <th className="numeric">Failed</th>
                  <th className="numeric">Score</th>
                  <th className="numeric">Change (percentage points)</th>
                </tr>
              </thead>
              <tbody>
                {d.domains.map((row) => (
                  <tr key={row.domain}>
                    <td>{row.domain.replaceAll("-", " ")}</td>
                    <td className="numeric">{number(row.checked)}</td>
                    <td className="numeric">{number(row.failed)}</td>
                    <td className="numeric">
                      {row.score === null
                        ? "No observations"
                        : `${number(row.score, 2)}%`}
                    </td>
                    <td className="numeric">
                      {row.change === null
                        ? "No comparable baseline"
                        : `${row.change > 0 ? "+" : ""}${number(row.change, 2)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </>
        )}
      </State>
    </Card>
  );
}
