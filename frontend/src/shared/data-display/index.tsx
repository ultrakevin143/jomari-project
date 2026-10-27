"use client";

import { type ApiFailure } from "@/shared/api/client";
import { Alert, Button, Input, Loading, Select } from "@/shared/ui/index";
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
} from "lucide-react";
import { useState } from "react";

export function State({
  loading,
  error,
  retry,
  children,
}: {
  loading: boolean;
  error?: Error;
  retry: () => void;
  children: React.ReactNode;
}) {
  return error ? (
    <QueryError error={error} retry={retry} />
  ) : loading ? (
    <Loading />
  ) : (
    <>{children}</>
  );
}
export function Refresh({ refresh }: { refresh: () => void }) {
  return (
    <Button variant="outline" onClick={refresh}>
      <RefreshCw size={15} />
      Refresh
    </Button>
  );
}
export function SearchBox({
  onSearch,
  placeholder = "Search records",
}: {
  onSearch: (value: string) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  return (
    <form
      className="school-search"
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(draft);
      }}
    >
      <Input
        aria-label={placeholder}
        placeholder={placeholder}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      <Button variant="outline" type="submit">
        Search
      </Button>
    </form>
  );
}
export function PageHeading({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action && <div className="heading-action">{action}</div>}
    </div>
  );
}
export function QueryError({
  error,
  retry,
}: {
  error: Error | ApiFailure;
  retry: () => void;
}) {
  const forbidden = "status" in error && error.status === 403;
  return (
    <Alert title={forbidden ? "Access is restricted" : "Data is unavailable"}>
      {error.message}
      {!forbidden && (
        <Button variant="outline" size="sm" onClick={retry}>
          <RefreshCw size={14} />
          Try again
        </Button>
      )}
    </Alert>
  );
}
export function Pager({
  pagination,
  onPage,
}: {
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    pages: number;
  };
  onPage: (page: number) => void;
}) {
  const { page, pageSize, total, pages } = pagination;
  return (
    <div className="pager">
      <span>
        {total
          ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total} records`
          : "0 records"}
      </span>
      <div>
        <Button
          variant="outline"
          size="icon"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft size={16} />
        </Button>
        <span>
          Page {page} of {Math.max(pages, 1)}
        </span>
        <Button
          variant="outline"
          size="icon"
          aria-label="Next page"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  );
}
export function Filters({
  search,
  onSearch,
  status,
  onStatus,
  statuses,
  sort,
  onSort,
  sortField,
  searchLabel = "Search source record ID",
}: {
  search: string;
  onSearch: (value: string) => void;
  status?: string;
  onStatus?: (value: string) => void;
  statuses?: string[];
  sort?: string;
  onSort?: () => void;
  sortField?: string;
  searchLabel?: string;
}) {
  const [draft, setDraft] = useState(search);
  return (
    <div className="filters">
      <form
        className="search-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSearch(draft);
        }}
      >
        <Search size={16} />
        <Input
          aria-label={searchLabel}
          placeholder={searchLabel}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (!e.target.value) onSearch("");
          }}
        />
        <Button variant="ghost" size="sm" type="submit">
          Search
        </Button>
      </form>
      <div className="filter-actions">
        {statuses && onStatus && (
          <Select
            label="Filter status"
            value={status || "ALL"}
            onValueChange={onStatus}
            options={[
              { value: "ALL", label: "All statuses" },
              ...statuses.map((s) => ({
                value: s,
                label: s
                  .toLowerCase()
                  .replaceAll("_", " ")
                  .replace(/^\w/, (c) => c.toUpperCase()),
              })),
            ]}
          />
        )}
        {onSort && (
          <Button variant="outline" size="sm" onClick={onSort}>
            <ArrowUpDown size={14} />
            {sortField ? `${sortField}: ` : ""}
            {sort === "asc" ? "Oldest first" : "Newest first"}
          </Button>
        )}
      </div>
    </div>
  );
}
export function DetailFields({ data }: { data: Record<string, unknown> }) {
  return (
    <dl className="detail-fields">
      {Object.entries(data)
        .filter(
          ([key]) =>
            !["passwordHash", "organizationId", "sourceVersion"].includes(key),
        )
        .map(([key, value]) => (
          <div key={key}>
            <dt>
              {key
                .replace(/([A-Z])/g, " $1")
                .replace(/^\w/, (c) => c.toUpperCase())}
            </dt>
            <dd>
              {value === null ? (
                "—"
              ) : typeof value === "object" ? (
                <pre>{JSON.stringify(value, null, 2)}</pre>
              ) : (
                String(value)
              )}
            </dd>
          </div>
        ))}
    </dl>
  );
}
