"use client";

import { type Page } from "@/shared/api/contracts";
import {
  PageHeading,
  Pager,
  Refresh,
  SearchBox,
  State,
} from "@/shared/data-display/index";
import { dateTime, number } from "@/shared/lib/utils";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Empty,
  Input,
  Label,
  Select,
  Status,
  Table,
} from "@/shared/ui/index";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";

export type Route = {
  id: string;
  code: string;
  name: string;
  scheduledAt: string;
  status: string;
  area: {
    id: string;
    name: string;
  };
  vehicle: string | null;
  scheduledStops: number;
  completedStops: number;
  missedStops: number;
  eventCount: number;
  overdue: boolean;
  findings: string[];
};
export type Reliability = Page<Route> & {
  summary: {
    routes: number;
    scheduledStops: number;
    completedStops: number;
    missedStops: number;
    completionPct: number | null;
    overdueRoutes: number;
    unassignedRoutes: number;
    routesWithFindings: number;
  };
  areas: {
    id: string;
    name: string;
  }[];
  period: {
    from: string;
    to: string;
    timezone: string;
  };
  coverage: string;
};
export function ReliabilityView() {
  const [period, setPeriod] = useState<{
      from: string;
      to: string;
    } | null>(null),
    [area, setArea] = useState("all"),
    [page, setPage] = useState(1),
    [search, setSearch] = useState("");
  const q = new URLSearchParams({
      ...period,
      page: String(page),
      search,
      ...(area !== "all" ? { areaId: area } : {}),
    }),
    { data, error, isLoading, mutate } = useSWR<Reliability>(
      `/insights/collection-reliability?${q}`,
    ),
    s = data?.summary;
  return (
    <>
      <PageHeading
        title="Collection reliability"
        description="Review missed stops, overdue routes and missing source evidence before reporting service performance."
        action={<Refresh refresh={() => mutate()} />}
      />
      <form
        className="school-period"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          setPeriod({
            from: String(form.get("from")),
            to: String(form.get("to")),
          });
          setPage(1);
        }}
      >
        <div className="field">
          <Label htmlFor="reliability-from">Start date (UTC)</Label>
          <Input id="reliability-from" name="from" type="date" required />
        </div>
        <div className="field">
          <Label htmlFor="reliability-to">End date (inclusive, UTC)</Label>
          <Input id="reliability-to" name="to" type="date" required />
        </div>
        <Button variant="outline" type="submit">
          Apply period
        </Button>
        <Button
          variant="ghost"
          type="reset"
          onClick={() => {
            setPeriod(null);
            setPage(1);
          }}
        >
          Default period
        </Button>
        <Select
          label="Reliability service area"
          value={area}
          onValueChange={(v) => {
            setArea(v);
            setPage(1);
          }}
          options={[
            { value: "all", label: "All service areas" },
            ...(data?.areas ?? []).map((a) => ({ value: a.id, label: a.name })),
          ]}
        />
      </form>
      <State loading={isLoading} error={error} retry={() => mutate()}>
        {data && s && (
          <>
            <p className="school-note">
              {data.period.from} through {data.period.to} · Inclusive dates ·{" "}
              {data.period.timezone} · Synthetic data
            </p>
            <div className="report-metrics school-metrics">
              {[
                ["Scheduled routes", s.routes],
                ["Scheduled stops", s.scheduledStops],
                ["Completed stops", s.completedStops],
                ["Missed stops", s.missedStops],
                [
                  "Stop completion",
                  s.completionPct === null
                    ? "No scheduled stops"
                    : `${s.completionPct}%`,
                ],
                ["Overdue routes", s.overdueRoutes],
                ["Unassigned routes", s.unassignedRoutes],
                ["Routes with findings", s.routesWithFindings],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <span>{label}</span>
                  <strong>
                    {typeof value === "number" ? number(value) : value}
                  </strong>
                </div>
              ))}
            </div>
            <p className="school-note">{data.coverage}</p>
            <Card>
              <CardHeader>
                <div>
                  <h2>Route exceptions and evidence</h2>
                  <p>
                    Open a route to investigate its source lineage. Findings can
                    overlap.
                  </p>
                </div>
                <SearchBox
                  placeholder="Search routes"
                  onSearch={(v) => {
                    setSearch(v);
                    setPage(1);
                  }}
                />
              </CardHeader>
              <Table>
                <thead>
                  <tr>
                    <th>Route / service date</th>
                    <th>Area / vehicle</th>
                    <th>Status</th>
                    <th className="numeric">Completed / scheduled</th>
                    <th className="numeric">Events</th>
                    <th>Findings</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <Link
                          className="record-link"
                          href={`/operations/routes/${row.id}`}
                        >
                          {row.code} · {row.name}
                        </Link>
                        <div className="school-small">
                          {dateTime(row.scheduledAt)}
                        </div>
                      </td>
                      <td>
                        {row.area.name}
                        <div className="school-small">
                          {row.vehicle ?? "Unassigned"}
                        </div>
                      </td>
                      <td>
                        <Status value={row.status} />
                      </td>
                      <td className="numeric">
                        {row.completedStops} / {row.scheduledStops}
                      </td>
                      <td className="numeric">{row.eventCount}</td>
                      <td>
                        {row.findings.length ? (
                          <ul className="finding-links">
                            {row.findings.map((f) => (
                              <li key={f}>{f}</li>
                            ))}
                          </ul>
                        ) : (
                          <Badge tone="success">No findings</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              {!data.data.length && (
                <Empty title="No matching routes">
                  Change the dates, service area or search. No example metrics
                  replace missing records.
                </Empty>
              )}
              <Pager pagination={data.pagination} onPage={setPage} />
            </Card>
          </>
        )}
      </State>
    </>
  );
}
