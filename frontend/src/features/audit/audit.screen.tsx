"use client";

import { type Audit } from "@/features/audit/types";
import { type Page } from "@/shared/api/contracts";
import {
  DetailFields,
  Filters,
  PageHeading,
  Pager,
  QueryError,
} from "@/shared/data-display/index";
import { dateTime, label } from "@/shared/lib/utils";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Dialog,
  Empty,
  Loading,
  Select,
  Table,
} from "@/shared/ui/index";
import { ArrowRight, RefreshCw, ShieldCheck } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";

export function AuditView() {
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [sort, setSort] = useState("desc"),
    [entity, setEntity] = useState("ALL"),
    [selected, setSelected] = useState<Audit | null>(null);
  const { data, error, isLoading, mutate, isValidating } = useSWR<Page<Audit>>(
    `/audit-events?page=${page}&pageSize=15&search=${encodeURIComponent(search)}&sort=${sort}${entity !== "ALL" ? `&entity=${entity}` : ""}`,
  );
  return (
    <>
      <PageHeading
        title="Audit log"
        description="Append-only events for access, imports, quality checks, governance changes and exports."
        action={
          <Button
            variant="outline"
            disabled={isValidating}
            onClick={() => void mutate()}
          >
            <RefreshCw size={15} />
            Refresh
          </Button>
        }
      />
      <div className="audit-explainer">
        <ShieldCheck size={21} />
        <div>
          <strong>Administrative changes leave a record.</strong>
          <p>
            Events cannot be updated or deleted through the app. Database
            triggers protect existing audit rows.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <div>
            <h2>Workspace activity</h2>
            <p>Organization-scoped events, newest first</p>
          </div>
          <Select
            label="Audit entity"
            value={entity}
            onValueChange={(value) => {
              setEntity(value);
              setPage(1);
            }}
            options={[
              { value: "ALL", label: "All entities" },
              ...[
                "session",
                "integration-run",
                "import-record",
                "dq-run",
                "dq-result",
                "data-asset",
                "operations",
                "diversion",
                "organization",
              ].map((value) => ({ value, label: label(value) })),
            ]}
          />
        </CardHeader>
        <Filters
          search={search}
          searchLabel="Search action or actor"
          onSearch={(value) => {
            setSearch(value);
            setPage(1);
          }}
          sort={sort}
          onSort={() => {
            setSort(sort === "desc" ? "asc" : "desc");
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
                  <th>Time (UTC)</th>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Entity</th>
                  <th>Reason</th>
                  <th>
                    <span className="sr-only">Details</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((event) => (
                  <tr key={event.id}>
                    <td className="nowrap">{dateTime(event.createdAt)}</td>
                    <td>
                      <button
                        className="record-link"
                        onClick={() => setSelected(event)}
                      >
                        {label(event.action)}
                      </button>
                    </td>
                    <td>{event.actorName}</td>
                    <td>
                      <Badge>{event.entity}</Badge>
                    </td>
                    <td className="audit-reason">{event.reason || "—"}</td>
                    <td>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Inspect ${label(event.action)} event`}
                        onClick={() => setSelected(event)}
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
          <Empty title="No matching audit events">
            Try another actor, action or entity filter.
          </Empty>
        )}
      </Card>
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title="Audit event detail"
        description="Recorded context, request correlation ID and change metadata."
        wide
      >
        {selected && <DetailFields data={selected} />}
      </Dialog>
    </>
  );
}
