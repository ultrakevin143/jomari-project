"use client";

import { CollectionChart } from "@/features/overview/collection-chart";
import { type Overview } from "@/features/overview/types";
import { type Envelope } from "@/shared/api/contracts";
import { PageHeading, QueryError } from "@/shared/data-display/index";
import { dateTime, number } from "@/shared/lib/utils";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Empty,
  Input,
  Loading,
  Progress,
  Status,
  Table,
  Tooltip,
} from "@/shared/ui/index";
import {
  ArrowRight,
  CalendarDays,
  CheckCheck,
  Database,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";

export function OverviewView() {
  const [query, setQuery] = useState("");
  const { data, error, isLoading, mutate, isValidating } = useSWR<
    Envelope<Overview>
  >(`/overview${query}`);
  if (isLoading) return <Loading />;
  if (error) return <QueryError error={error} retry={() => void mutate()} />;
  if (!data) return null;
  const d = data.data,
    period = `${new Date(d.period.from + "T00:00:00Z").toLocaleDateString("en-PH", { day: "numeric", month: "short", timeZone: "UTC" })} – ${new Date(d.period.to + "T00:00:00Z").toLocaleDateString("en-PH", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}`;
  const fleetTotal = d.fleet.reduce((n, v) => n + v.count, 0),
    onRoute = d.fleet.find((v) => v.status === "ON_ROUTE")?.count ?? 0;
  return (
    <>
      <PageHeading
        title="Operations overview"
        description={d.organization.name}
        action={
          <Button
            variant="outline"
            disabled={isValidating}
            onClick={() => void mutate()}
          >
            <RefreshCw size={15} />
            {isValidating ? "Refreshing…" : "Refresh data"}
          </Button>
        }
      />
      <div className="overview-context">
        <div className="period-label">
          <CalendarDays size={16} />
          <strong>{period}</strong>
          <span>UTC</span>
          {d.demoMode && <Badge tone="info">Synthetic data</Badge>}
        </div>
        <form
          className="period-form"
          key={query}
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            setQuery(`?from=${form.get("from")}&to=${form.get("to")}`);
          }}
        >
          <Input
            type="date"
            name="from"
            aria-label="Reporting period start"
            defaultValue={d.period.from}
            required
          />
          <span>to</span>
          <Input
            type="date"
            name="to"
            aria-label="Reporting period end"
            defaultValue={d.period.to}
            required
          />
          <Button variant="outline" size="sm" type="submit">
            Apply
          </Button>
        </form>
      </div>
      <div className="metrics-grid">
        <Link href="/operations/routes" className="metric">
          <div className="metric-name">
            Collection completion
            <CheckCheck size={17} />
          </div>
          <div className="metric-value">
            {number(d.totals.completionPct, 1)}
            <span>%</span>
          </div>
          <p>
            {number(d.totals.completed)} of {number(d.totals.scheduled)}{" "}
            scheduled stops
          </p>
          <Progress
            value={d.totals.completionPct ?? 0}
            label="Completed collection stops"
          />
        </Link>
        <Link href="/operations/routes" className="metric">
          <div className="metric-name">
            Missed pickups
            <MapPin size={17} />
          </div>
          <div className="metric-value warning-text">
            {number(d.totals.missed)}
          </div>
          <p>Recorded missed stops in this period</p>
          <span className="metric-link">
            Review route performance <ArrowRight size={13} />
          </span>
        </Link>
        <Link href="/operations/weighbridge" className="metric">
          <div className="metric-name">
            Waste received
            <Database size={17} />
          </div>
          <div className="metric-value">
            {number(d.totals.netKg / 1000, 1)}
            <span>t</span>
          </div>
          <p>
            {number(d.totals.recoveredKg / 1000, 1)} t recovered ·{" "}
            {number(d.totals.diversionPct, 1)}% diversion
          </p>
          <span className="metric-link">
            Weighbridge & recovery <ArrowRight size={13} />
          </span>
        </Link>
        <Link href="/quality" className="metric">
          <div className="metric-name">
            Data quality score
            <ShieldCheck size={17} />
          </div>
          <div className="metric-value">
            {number(d.quality?.score, 1)}
            <span>{d.quality ? "%" : ""}</span>
          </div>
          <p>
            {d.quality
              ? `${number(d.quality.failed)} failed of ${number(d.quality.checked)} checks`
              : "Run a quality check to establish a score"}
          </p>
          <span className="metric-link">
            {d.quality ? "Latest completed quality run" : "Open data quality"}{" "}
            <ArrowRight size={13} />
          </span>
        </Link>
      </div>
      <div className="overview-panels">
        <Card>
          <CardHeader>
            <div>
              <h2>Collection performance</h2>
              <p>
                {d.series.length > 7
                  ? `Scheduled and completed stops in ${Math.ceil(d.series.length / 7)}-day groups`
                  : "Scheduled and completed stops, by day"}
              </p>
            </div>
            <Link className="text-link" href="/reports">
              View report <ArrowRight size={14} />
            </Link>
          </CardHeader>
          <div className="chart-body">
            {d.series.length ? (
              <CollectionChart series={d.series} />
            ) : (
              <Empty title="No collection activity">
                Import collection records for this period.
              </Empty>
            )}
          </div>
          <div className="panel-footnote">
            <Truck size={15} />
            <strong>
              {onRoute} of {fleetTotal}
            </strong>{" "}
            vehicles on route now<span>Current fleet status</span>
          </div>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <h2>Source health</h2>
              <p>Freshness & latest import status</p>
            </div>
            <Link
              href="/integrations"
              aria-label="Open integration monitor"
              className="icon-link"
            >
              <ArrowRight size={18} />
            </Link>
          </CardHeader>
          <div className="source-list">
            {d.sources.map((source) => (
              <Link href="/integrations" key={source.id} className="source-row">
                <span
                  className={`source-dot ${source.stale ? "stale" : source.lastRun?.failed ? "attention" : ""}`}
                />
                <div>
                  <strong>{source.name}</strong>
                  <small>
                    {source.stale
                      ? "Outside freshness window"
                      : source.lastRun?.failed
                        ? `${source.lastRun.failed} quarantined record${source.lastRun.failed === 1 ? "" : "s"}`
                        : source.method + " · Within freshness window"}
                  </small>
                </div>
                <Badge
                  tone={
                    source.stale || source.lastRun?.failed
                      ? "warning"
                      : "success"
                  }
                >
                  {source.stale
                    ? "Stale"
                    : source.lastRun?.failed
                      ? "Review"
                      : "Current"}
                </Badge>
              </Link>
            ))}
          </div>
        </Card>
      </div>
      <Card className="exceptions-card">
        <CardHeader>
          <div>
            <h2>
              Routes requiring attention{" "}
              <span className="count-label">
                {d.exceptions.length} service occurrences
              </span>
            </h2>
            <p>
              Highest missed pickup counts in this period; each row is one
              scheduled route.
            </p>
          </div>
          <Link className="text-link" href="/operations/routes">
            All routes <ArrowRight size={14} />
          </Link>
        </CardHeader>
        {d.exceptions.length ? (
          <Table>
            <thead>
              <tr>
                <th>Route</th>
                <th>Service area</th>
                <th>Vehicle</th>
                <th className="numeric">Completed / planned</th>
                <th className="numeric">Missed</th>
                <th>Status</th>
                <th>
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {d.exceptions.map((route) => (
                <tr key={route.id}>
                  <td>
                    <strong>{String(route.code)}</strong>
                    <small>{String(route.name)}</small>
                    <small>
                      {new Date(String(route.scheduledAt)).toLocaleDateString(
                        "en-PH",
                        {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          timeZone: "UTC",
                        },
                      )}
                    </small>
                  </td>
                  <td>
                    {String(
                      (
                        route.serviceArea as {
                          name: string;
                        }
                      ).name,
                    )}
                  </td>
                  <td className="mono">
                    {String(
                      (
                        route.vehicle as {
                          code: string;
                        } | null
                      )?.code ?? "Unassigned",
                    )}
                  </td>
                  <td className="numeric">
                    {number(Number(route.completedStops))}{" "}
                    <span className="muted">
                      / {number(Number(route.scheduledStops))}
                    </span>
                  </td>
                  <td className="numeric warning-text">
                    {number(Number(route.missedStops))}
                  </td>
                  <td>
                    <Status value={String(route.status)} />
                  </td>
                  <td>
                    <Tooltip text="Open route detail">
                      <Link
                        href={`/operations/routes/${route.id}`}
                        className="icon-link"
                        aria-label={`Open route ${route.code} scheduled ${new Date(String(route.scheduledAt)).toLocaleDateString("en-PH", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}`}
                      >
                        <ArrowRight size={16} />
                      </Link>
                    </Tooltip>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <Empty title="No route exceptions in this period">
            All recorded stops are accounted for. Review service totals in the
            operations report.
          </Empty>
        )}
      </Card>
      <div className="overview-bottom">
        <span>
          Snapshot loaded {dateTime(d.generatedAt)}. Refresh when you need an
          update.
        </span>
        <div>
          <Link href="/operations/work-orders">
            {d.openWorkOrders} open work orders <ArrowRight size={12} />
          </Link>
          <Link href="/operations/citizen-requests">
            {d.openRequests} active service requests <ArrowRight size={12} />
          </Link>
        </div>
      </div>
    </>
  );
}
