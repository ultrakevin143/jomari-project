"use client";

import { post } from "@/shared/api/client";
import {
  type Envelope,
  type Page,
  type Row,
  type User,
} from "@/shared/api/contracts";
import {
  DetailFields,
  Filters,
  PageHeading,
  Pager,
  QueryError,
} from "@/shared/data-display/index";
import { dateTime, label, number } from "@/shared/lib/utils";
import {
  Button,
  Card,
  Dialog,
  Empty,
  Input,
  Label,
  Loading,
  Status,
  Table,
} from "@/shared/ui/index";
import { Archive, ArrowRight, Download, MapPin, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

export const entities = [
  ["routes", "Collection routes"],
  ["vehicles", "Fleet"],
  ["facilities", "Facilities"],
  ["weighbridge", "Weighbridge"],
  ["recycling", "Recycling"],
  ["work-orders", "Work orders"],
  ["citizen-requests", "Citizen requests"],
  ["contracts", "Contracts"],
  ["collection-events", "Collection events"],
  ["telemetry", "Telemetry"],
] as const;
export type Column = {
  key: string;
  label: string;
  type?: "number" | "weight" | "date" | "status" | "percent";
};
export const columns: Record<string, Column[]> = {
  routes: [
    { key: "code", label: "Route" },
    { key: "name", label: "Name" },
    { key: "serviceArea.name", label: "Service area" },
    { key: "vehicle.code", label: "Vehicle" },
    { key: "scheduledAt", label: "Scheduled", type: "date" },
    { key: "completedStops", label: "Completed", type: "number" },
    { key: "missedStops", label: "Missed", type: "number" },
    { key: "status", label: "Status", type: "status" },
  ],
  vehicles: [
    { key: "code", label: "Fleet ID" },
    { key: "registration", label: "Registration" },
    { key: "type", label: "Vehicle type" },
    { key: "capacityKg", label: "Capacity (kg)", type: "number" },
    { key: "mileageKm", label: "Odometer (km)", type: "number" },
    { key: "fuelLitres", label: "Fuel (L)", type: "number" },
    { key: "status", label: "Status", type: "status" },
  ],
  facilities: [
    { key: "code", label: "Facility" },
    { key: "name", label: "Name" },
    { key: "type", label: "Type" },
    { key: "location", label: "Location" },
    { key: "dailyCapacityKg", label: "Daily capacity (kg)", type: "number" },
  ],
  weighbridge: [
    { key: "ticketNumber", label: "Ticket" },
    { key: "facility.name", label: "Facility" },
    { key: "materialType.name", label: "Material" },
    { key: "occurredAt", label: "Received", type: "date" },
    { key: "grossKg", label: "Gross (kg)", type: "number" },
    { key: "tareKg", label: "Tare (kg)", type: "number" },
    { key: "netKg", label: "Net (kg)", type: "number" },
  ],
  recycling: [
    { key: "sourceRecordId", label: "Source record" },
    { key: "facility.name", label: "Facility" },
    { key: "materialType.name", label: "Material" },
    { key: "receivedKg", label: "Received (kg)", type: "number" },
    { key: "recoveredKg", label: "Recovered (kg)", type: "number" },
    { key: "contaminationPct", label: "Contamination", type: "percent" },
    { key: "occurredAt", label: "Processed", type: "date" },
  ],
  "work-orders": [
    { key: "reference", label: "Work order" },
    { key: "title", label: "Issue" },
    { key: "vehicle.code", label: "Vehicle" },
    { key: "assignee", label: "Assigned team" },
    { key: "priority", label: "Priority", type: "status" },
    { key: "status", label: "Status", type: "status" },
    { key: "dueAt", label: "Due", type: "date" },
  ],
  "citizen-requests": [
    { key: "reference", label: "Request" },
    { key: "category", label: "Category" },
    { key: "location", label: "Service location" },
    { key: "reportedAt", label: "Reported", type: "date" },
    { key: "status", label: "Status", type: "status" },
    { key: "resolvedAt", label: "Resolved", type: "date" },
  ],
  contracts: [
    { key: "reference", label: "Contract" },
    { key: "vendor", label: "Contractor" },
    { key: "serviceArea.name", label: "Service area" },
    { key: "slaTargetPct", label: "SLA target", type: "percent" },
    { key: "ratePerTonne", label: "PHP / tonne", type: "number" },
    { key: "validUntil", label: "Valid until", type: "date" },
  ],
  "collection-events": [
    { key: "sourceRecordId", label: "Event" },
    { key: "route.code", label: "Route" },
    { key: "vehicle.code", label: "Vehicle" },
    { key: "occurredAt", label: "Timestamp", type: "date" },
    { key: "status", label: "Status", type: "status" },
  ],
  telemetry: [
    { key: "sourceRecordId", label: "Event" },
    { key: "vehicle.code", label: "Vehicle" },
    { key: "occurredAt", label: "Timestamp", type: "date" },
    { key: "latitude", label: "Latitude", type: "number" },
    { key: "longitude", label: "Longitude", type: "number" },
    { key: "mileageKm", label: "Odometer (km)", type: "number" },
    { key: "fuelLitres", label: "Fuel (L)", type: "number" },
  ],
};
export const statuses: Record<string, string[]> = {
  routes: ["COMPLETED", "MISSED", "IN_PROGRESS", "SCHEDULED"],
  vehicles: ["AVAILABLE", "ON_ROUTE", "MAINTENANCE"],
  "work-orders": ["OPEN", "IN_PROGRESS", "COMPLETED"],
  "citizen-requests": ["OPEN", "ASSIGNED", "RESOLVED", "CLOSED"],
};
export function cell(row: Row, column: Column) {
  const value = column.key
    .split(".")
    .reduce<unknown>(
      (obj, key) =>
        obj && typeof obj === "object"
          ? (obj as Record<string, unknown>)[key]
          : null,
      row,
    );
  if (value === null || value === undefined) return "—";
  if (column.type === "status") return <Status value={String(value)} />;
  if (column.type === "number")
    return number(Number(value), Number.isInteger(Number(value)) ? 0 : 1);
  if (column.type === "percent") return number(Number(value), 1) + "%";
  if (column.type === "date") return dateTime(String(value));
  if (column.key === "type") return label(String(value));
  return String(value);
}
export function RecordDetail({
  entity,
  id,
  user,
  onArchived,
}: {
  entity: string;
  id: string;
  user: User;
  onArchived: () => void;
}) {
  const { data, error, isLoading, mutate } = useSWR<Envelope<Row>>(
    `/operations/${entity}/${id}`,
  );
  const [archive, setArchive] = useState(false),
    [busy, setBusy] = useState(false);
  if (isLoading) return <Loading />;
  if (error) return <QueryError error={error} retry={() => void mutate()} />;
  if (!data) return null;
  return (
    <>
      <div className="record-note">
        <MapPin size={16} />
        <span>Canonical record · Source lineage and related records</span>
      </div>
      <DetailFields data={data.data} />
      {user.permissions.includes("operations:write") &&
        ["routes", "vehicles", "facilities"].includes(entity) && (
          <div className="archive-section">
            {archive ? (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  try {
                    await post(`/operations/${entity}/${id}/archive`, {
                      reason: new FormData(e.currentTarget).get("reason"),
                    });
                    toast.success("Record archived.");
                    onArchived();
                  } catch (err) {
                    toast.error(
                      err instanceof Error ? err.message : "Archive failed.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Label htmlFor="archive-reason">Reason for archiving</Label>
                <Input
                  id="archive-reason"
                  name="reason"
                  required
                  minLength={8}
                  maxLength={500}
                  placeholder="Explain why this record should be archived"
                />
                <div className="form-actions">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => setArchive(false)}
                  >
                    Cancel
                  </Button>
                  <Button variant="destructive" disabled={busy}>
                    Archive record
                  </Button>
                </div>
              </form>
            ) : (
              <Button variant="outline" onClick={() => setArchive(true)}>
                <Archive size={15} />
                Archive record
              </Button>
            )}
          </div>
        )}
    </>
  );
}
export function OperationsView({
  entity,
  user,
  record,
}: {
  entity: string;
  user: User;
  record?: string;
}) {
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState("ALL"),
    [sort, setSort] = useState("desc"),
    [selected, setSelected] = useState<string | null>(record ?? null);
  const valid = !!columns[entity];
  const { data, error, isLoading, mutate, isValidating } = useSWR<Page<Row>>(
    valid
      ? `/operations/${entity}?page=${page}&pageSize=10&search=${encodeURIComponent(search)}&sort=${sort}${status !== "ALL" ? `&status=${status}` : ""}`
      : null,
  );
  const title = entities.find(([key]) => key === entity)?.[1] ?? "Operations";
  if (!valid)
    return (
      <Empty title="Operational view not found">
        Choose a record type from the navigation.
      </Empty>
    );
  return (
    <>
      <PageHeading
        title={title}
        description="Typed, validated records with traceable source identifiers."
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
            {user.permissions.includes("integrations:write") && (
              <Button asChild>
                <Link href="/integrations">
                  <Download size={16} />
                  Import data
                </Link>
              </Button>
            )}
          </>
        }
      />
      <nav className="operation-tabs" aria-label="Operational record types">
        {entities.map(([key, name]) => (
          <Link
            key={key}
            href={`/operations/${key}`}
            aria-current={key === entity ? "page" : undefined}
            className={key === entity ? "selected" : ""}
          >
            {name}
          </Link>
        ))}
      </nav>
      <Card>
        <Filters
          search={search}
          onSearch={(value) => {
            setSearch(value);
            setPage(1);
          }}
          status={status}
          statuses={statuses[entity]}
          onStatus={(value) => {
            setStatus(value);
            setPage(1);
          }}
          sort={sort}
          sortField="Source updated"
          onSort={() => {
            setSort(sort === "asc" ? "desc" : "asc");
            setPage(1);
          }}
        />
        {isLoading ? (
          <Loading />
        ) : error ? (
          <QueryError error={error} retry={() => void mutate()} />
        ) : data?.data.length ? (
          <>
            <Table>
              <thead>
                <tr>
                  {columns[entity]!.map((c) => (
                    <th
                      key={c.key}
                      className={
                        ["number", "percent", "weight"].includes(c.type ?? "")
                          ? "numeric"
                          : ""
                      }
                    >
                      {c.label}
                    </th>
                  ))}
                  <th>
                    <span className="sr-only">Details</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((row) => (
                  <tr key={row.id}>
                    {columns[entity]!.map((c, i) => (
                      <td
                        key={c.key}
                        className={
                          ["number", "percent"].includes(c.type ?? "")
                            ? "numeric"
                            : ""
                        }
                      >
                        {i === 0 ? (
                          <button
                            className="record-link"
                            onClick={() => setSelected(row.id)}
                          >
                            {cell(row, c)}
                          </button>
                        ) : (
                          cell(row, c)
                        )}
                      </td>
                    ))}
                    <td>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Open record ${row.sourceRecordId}`}
                        onClick={() => setSelected(row.id)}
                      >
                        <ArrowRight size={15} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pager pagination={data.pagination} onPage={setPage} />
          </>
        ) : (
          <Empty title="No matching operational records">
            Try another source ID or status, or load validated data through
            Integrations.
          </Empty>
        )}
      </Card>
      <div className="page-footnote">
        Records are sorted by source update time. Citizen aliases are masked
        from operational views.
      </div>
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title={`${title} · record detail`}
        description="Canonical values, source identifiers and timestamps. All timestamps are UTC."
        wide
      >
        {selected && (
          <RecordDetail
            entity={entity}
            id={selected}
            user={user}
            onArchived={() => {
              setSelected(null);
              void mutate();
            }}
          />
        )}
      </Dialog>
    </>
  );
}
