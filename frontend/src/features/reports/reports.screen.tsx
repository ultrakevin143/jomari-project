"use client";

import { type Overview } from "@/features/overview/types";
import { type Envelope } from "@/shared/api/contracts";
import { PageHeading, Pager, QueryError } from "@/shared/data-display/index";
import { number } from "@/shared/lib/utils";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Empty,
  Input,
  Loading,
  Table,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/shared/ui/index";
import { Download, FileClock, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

export type Report = {
  period: {
    from: string;
    to: string;
    timezone: string;
  };
  totals: Overview["totals"];
  rows: Record<string, unknown>[];
};
export function ReportsView() {
  const [type, setType] = useState("operations"),
    [period, setPeriod] = useState(""),
    [downloading, setDownloading] = useState(false),
    [previewPage, setPreviewPage] = useState(1);
  const { data, error, isLoading, mutate, isValidating } = useSWR<
    Envelope<Report>
  >(`/reports/${type}${period}`);
  async function download() {
    setDownloading(true);
    try {
      const query = new URLSearchParams(period.replace(/^\?/, ""));
      query.set("format", "csv");
      const response = await fetch(`/api/reports/${type}?${query}`, {
        credentials: "same-origin",
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body?.error?.message || "Export failed.");
      }
      const blob = await response.blob(),
        url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = `${type}-${data?.data.period.from ?? "report"}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(
        "CSV exported. This download was recorded in the audit log.",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setDownloading(false);
    }
  }
  const report = data?.data,
    keys = report?.rows[0] ? Object.keys(report.rows[0]) : [],
    pageRows =
      report?.rows.slice((previewPage - 1) * 10, previewPage * 10) ?? [];
  return (
    <>
      <PageHeading
        title="Operational reports"
        description="Inspect the reporting period, preview the underlying rows, and export an audited CSV."
        action={
          <>
            <Button
              variant="outline"
              disabled={isValidating}
              onClick={() => void mutate()}
            >
              <RefreshCw size={15} />
              Refresh
            </Button>
            <Button
              disabled={downloading || !report}
              onClick={() => void download()}
            >
              <Download size={16} />
              {downloading ? "Exporting…" : "Export CSV"}
            </Button>
          </>
        }
      />
      <Tabs
        value={type}
        onValueChange={(value) => {
          setType(value);
          setPreviewPage(1);
        }}
      >
        <TabsList>
          <TabsTrigger value="operations">Collection & service</TabsTrigger>
          <TabsTrigger value="diversion">Recycling & diversion</TabsTrigger>
        </TabsList>
      </Tabs>
      {isLoading ? (
        <Loading />
      ) : error ? (
        <QueryError error={error} retry={() => void mutate()} />
      ) : (
        report && (
          <>
            <Card className="report-context">
              <div>
                <FileClock size={20} />
                <div>
                  <h2>
                    {type === "operations"
                      ? "Collection performance report"
                      : "Recycling mass-balance report"}
                  </h2>
                  <p>
                    {report.period.from} through {report.period.to} · Inclusive
                    dates · UTC
                  </p>
                </div>
              </div>
              <form
                className="period-form"
                key={period}
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  setPeriod(`?from=${form.get("from")}&to=${form.get("to")}`);
                  setPreviewPage(1);
                }}
              >
                <Input
                  type="date"
                  name="from"
                  aria-label="Report start date"
                  required
                  defaultValue={report.period.from}
                />
                <span>to</span>
                <Input
                  type="date"
                  name="to"
                  aria-label="Report end date"
                  required
                  defaultValue={report.period.to}
                />
                <Button variant="outline" size="sm" type="submit">
                  Apply
                </Button>
              </form>
            </Card>
            <div className="report-metrics">
              {type === "operations" ? (
                <>
                  <div>
                    <span>Scheduled stops</span>
                    <strong>{number(report.totals.scheduled)}</strong>
                  </div>
                  <div>
                    <span>Completed stops</span>
                    <strong>{number(report.totals.completed)}</strong>
                  </div>
                  <div>
                    <span>Missed pickups</span>
                    <strong className="warning-text">
                      {number(report.totals.missed)}
                    </strong>
                  </div>
                  <div>
                    <span>Completion rate</span>
                    <strong>{number(report.totals.completionPct, 1)}%</strong>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <span>Total waste received</span>
                    <strong>{number(report.totals.netKg / 1000, 1)} t</strong>
                  </div>
                  <div>
                    <span>Material recovered</span>
                    <strong>
                      {number(report.totals.recoveredKg / 1000, 1)} t
                    </strong>
                  </div>
                  <div>
                    <span>Diversion rate</span>
                    <strong>{number(report.totals.diversionPct, 1)}%</strong>
                  </div>
                  <div>
                    <span>Weighted contamination</span>
                    <strong>
                      {number(report.totals.contaminationPct, 1)}%
                    </strong>
                  </div>
                </>
              )}
            </div>
            <p className="report-formula">
              {type === "operations"
                ? "Completion = completed stops ÷ scheduled stops × 100. Missed stops remain a separate exception count."
                : "Diversion = recovered kg ÷ all net weighbridge receipts × 100. Contamination is weighted by received kg at recovery facilities; the CSV contains recovery rows."}
            </p>
            <Card>
              <CardHeader>
                <div>
                  <h2>Report records</h2>
                  <p>
                    {report.rows.length} canonical records in the selected
                    period
                  </p>
                </div>
                <Badge>CSV export available</Badge>
              </CardHeader>
              {report.rows.length ? (
                <>
                  <Table>
                    <thead>
                      <tr>
                        {keys.map((key) => (
                          <th key={key}>
                            {key
                              .replace(/([A-Z])/g, " $1")
                              .replace(/^\w/, (c) => c.toUpperCase())}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((row, index) => (
                        <tr key={index}>
                          {keys.map((key) => (
                            <td
                              key={key}
                              className={
                                typeof row[key] === "number" ? "numeric" : ""
                              }
                            >
                              {row[key] === null
                                ? "—"
                                : typeof row[key] === "number"
                                  ? number(
                                      row[key] as number,
                                      Number.isInteger(row[key]) ? 0 : 1,
                                    )
                                  : String(row[key])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                  <Pager
                    pagination={{
                      page: previewPage,
                      pageSize: 10,
                      total: report.rows.length,
                      pages: Math.ceil(report.rows.length / 10),
                    }}
                    onPage={setPreviewPage}
                  />
                </>
              ) : (
                <Empty title="No records in this reporting period">
                  Choose a period with imported operational records.
                </Empty>
              )}
            </Card>
            <div className="page-footnote">
              Exports apply your organization boundary and escape spreadsheet
              formula cells. Each download creates an audit event.
            </div>
          </>
        )
      )}
    </>
  );
}
