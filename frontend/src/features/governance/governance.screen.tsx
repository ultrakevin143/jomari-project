"use client";

import { type Asset } from "@/features/governance/types";
import { api } from "@/shared/api/client";
import { type Envelope, type Page, type User } from "@/shared/api/contracts";
import {
  Filters,
  PageHeading,
  Pager,
  QueryError,
} from "@/shared/data-display/index";
import { label, number } from "@/shared/lib/utils";
import {
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
import { ArrowRight, Pencil, RefreshCw, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

export type Domain = {
  id: string;
  name: string;
  description: string;
  owner: string;
  steward: string;
  _count: {
    assets: number;
  };
};
export function GovernanceView({ user }: { user: User }) {
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [domainId, setDomainId] = useState("ALL"),
    [classification, setClassification] = useState("ALL"),
    [selected, setSelected] = useState<Asset | null>(null),
    [editing, setEditing] = useState(false),
    [newClassification, setNewClassification] = useState("INTERNAL"),
    [busy, setBusy] = useState(false);
  const domains = useSWR<Envelope<Domain[]>>("/governance/domains"),
    assets = useSWR<Page<Asset>>(
      `/governance/assets?page=${page}&pageSize=10&sort=asc&search=${encodeURIComponent(search)}${domainId !== "ALL" ? `&domainId=${domainId}` : ""}${classification !== "ALL" ? `&classification=${classification}` : ""}`,
    );
  function open(asset: Asset) {
    setSelected(asset);
    setNewClassification(asset.classification);
    setEditing(false);
  }
  return (
    <>
      <PageHeading
        title="Governance catalog"
        description="Know who owns the data, how it is classified, and how long it is retained."
        action={
          <Button
            variant="outline"
            disabled={assets.isValidating}
            onClick={() => {
              void assets.mutate();
              void domains.mutate();
            }}
          >
            <RefreshCw size={15} />
            Refresh
          </Button>
        }
      />
      {domains.isLoading ? (
        <Loading />
      ) : domains.error ? (
        <QueryError error={domains.error} retry={() => void domains.mutate()} />
      ) : (
        <div className="domain-catalog">
          {domains.data?.data.map((domain) => (
            <button
              key={domain.id}
              className={
                domainId === domain.id ? "domain-tile selected" : "domain-tile"
              }
              onClick={() => {
                setDomainId(domainId === domain.id ? "ALL" : domain.id);
                setPage(1);
              }}
              aria-pressed={domainId === domain.id}
            >
              <div>
                <ShieldCheck size={18} />
                <Badge>{domain._count.assets} assets</Badge>
              </div>
              <h2>{domain.name}</h2>
              <p>{domain.description}</p>
              <small>Owner: {domain.owner}</small>
              <small>Steward: {domain.steward}</small>
            </button>
          ))}
        </div>
      )}
      <Card>
        <CardHeader>
          <div>
            <h2>Governed data assets</h2>
            <p>
              Policies are metadata; automated deletion requires a separately
              approved retention job.
            </p>
          </div>
          <Select
            label="Data classification"
            value={classification}
            onValueChange={(value) => {
              setClassification(value);
              setPage(1);
            }}
            options={[
              { value: "ALL", label: "All classifications" },
              ...["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"].map(
                (value) => ({ value, label: label(value) }),
              ),
            ]}
          />
        </CardHeader>
        <Filters
          search={search}
          searchLabel="Search data asset name"
          onSearch={(value) => {
            setSearch(value);
            setPage(1);
          }}
        />
        {domainId !== "ALL" && (
          <div className="active-filter">
            <Badge>
              {domains.data?.data.find((d) => d.id === domainId)?.name} domain
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDomainId("ALL");
                setPage(1);
              }}
            >
              Clear domain filter
            </Button>
          </div>
        )}
        {assets.isLoading ? (
          <Loading />
        ) : assets.error ? (
          <QueryError error={assets.error} retry={() => void assets.mutate()} />
        ) : assets.data?.data.length ? (
          <>
            <Table>
              <thead>
                <tr>
                  <th>Data asset</th>
                  <th>Domain</th>
                  <th>Accountable owner</th>
                  <th>Classification</th>
                  <th className="numeric">Retention</th>
                  <th>
                    <span className="sr-only">Details</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {assets.data.data.map((asset) => (
                  <tr key={asset.id}>
                    <td>
                      <button
                        className="record-link"
                        onClick={() => open(asset)}
                      >
                        {asset.name}
                      </button>
                      <small>
                        {asset.sourceSystem.method} · {asset.entity}
                      </small>
                    </td>
                    <td>{asset.domain.name}</td>
                    <td>
                      {asset.owner}
                      <small>{asset.steward}</small>
                    </td>
                    <td>
                      <Status value={asset.classification} />
                      {asset.containsPii && <small>PII policy required</small>}
                    </td>
                    <td className="numeric">
                      {number(asset.retentionDays)} days
                    </td>
                    <td>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Open ${asset.name}`}
                        onClick={() => open(asset)}
                      >
                        <ArrowRight size={15} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pager pagination={assets.data.pagination} onPage={setPage} />
          </>
        ) : (
          <Empty title="No matching governed assets">
            Change the domain, classification or name filter.
          </Empty>
        )}
      </Card>
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title={selected?.name ?? "Data asset"}
        description="Ownership, classification, retention and source-to-output lineage."
        wide
      >
        {selected && (
          <>
            {editing ? (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  const form = new FormData(e.currentTarget);
                  try {
                    await api(`/governance/assets/${selected.id}`, {
                      method: "PATCH",
                      body: JSON.stringify({
                        owner: form.get("owner"),
                        steward: form.get("steward"),
                        classification: newClassification,
                        retentionDays: Number(form.get("retentionDays")),
                        policy: form.get("policy"),
                        reason: form.get("reason"),
                        version: selected.version,
                      }),
                    });
                    setSelected(null);
                    void assets.mutate();
                    toast.success("Policy updated with an audit trail.");
                  } catch (err) {
                    toast.error(
                      err instanceof Error ? err.message : "Update failed.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <div className="form-grid">
                  <div className="field">
                    <Label htmlFor="asset-owner">Accountable owner</Label>
                    <Input
                      id="asset-owner"
                      name="owner"
                      defaultValue={selected.owner}
                      minLength={2}
                      maxLength={100}
                      required
                    />
                  </div>
                  <div className="field">
                    <Label htmlFor="asset-steward">Data steward</Label>
                    <Input
                      id="asset-steward"
                      name="steward"
                      defaultValue={selected.steward}
                      minLength={2}
                      maxLength={100}
                      required
                    />
                  </div>
                  <div className="field">
                    <Label>Classification</Label>
                    <Select
                      label="Asset classification"
                      value={newClassification}
                      onValueChange={setNewClassification}
                      options={[
                        "PUBLIC",
                        "INTERNAL",
                        "CONFIDENTIAL",
                        "RESTRICTED",
                      ].map((value) => ({ value, label: label(value) }))}
                    />
                  </div>
                  <div className="field">
                    <Label htmlFor="retention-days">Retention (days)</Label>
                    <Input
                      id="retention-days"
                      name="retentionDays"
                      type="number"
                      min={1}
                      max={36500}
                      defaultValue={selected.retentionDays}
                      required
                    />
                  </div>
                </div>
                <div className="field">
                  <Label htmlFor="asset-policy">
                    Retention & access policy
                  </Label>
                  <Textarea
                    id="asset-policy"
                    name="policy"
                    minLength={8}
                    maxLength={1000}
                    defaultValue={selected.policy}
                    required
                  />
                </div>
                <div className="field">
                  <Label htmlFor="policy-reason">
                    Reason for policy change
                  </Label>
                  <Textarea
                    id="policy-reason"
                    name="reason"
                    required
                    minLength={8}
                    maxLength={500}
                    placeholder="Explain the operational or governance reason for this update."
                  />
                </div>
                <p className="field-help">
                  Version {selected.version} is checked before saving to prevent
                  overwriting another steward’s update.
                </p>
                <div className="form-actions">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => setEditing(false)}
                  >
                    Cancel
                  </Button>
                  <Button disabled={busy}>
                    {busy ? "Saving…" : "Save governance policy"}
                  </Button>
                </div>
              </form>
            ) : (
              <>
                <div className="run-summary">
                  <Status value={selected.classification} />
                  <Badge>{selected.domain.name}</Badge>
                  <Badge>Version {selected.version}</Badge>
                </div>
                <dl className="detail-fields">
                  <div>
                    <dt>Accountable owner</dt>
                    <dd>{selected.owner}</dd>
                  </div>
                  <div>
                    <dt>Data steward</dt>
                    <dd>{selected.steward}</dd>
                  </div>
                  <div>
                    <dt>Retention</dt>
                    <dd>{number(selected.retentionDays)} days</dd>
                  </div>
                  <div>
                    <dt>PII designation</dt>
                    <dd>
                      {selected.containsPii
                        ? "Contains personal data; synthetic aliases in this workspace"
                        : "No PII designated"}
                    </dd>
                  </div>
                  <div>
                    <dt>Policy</dt>
                    <dd>{selected.policy}</dd>
                  </div>
                </dl>
                <div className="lineage-strip">
                  <div>
                    <span>Source</span>
                    <strong>{selected.sourceSystem.name}</strong>
                    <small>{selected.sourceSystem.method}</small>
                  </div>
                  <ArrowRight size={16} />
                  <div>
                    <span>Governance</span>
                    <strong>{selected.entity}</strong>
                    <small>
                      {selected.classification.toLowerCase()} canonical records
                    </small>
                  </div>
                  <ArrowRight size={16} />
                  <div>
                    <span>Output</span>
                    <Link
                      className="text-link"
                      href="/reports"
                      onClick={() => setSelected(null)}
                    >
                      Operational reporting <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>
                <h3 className="section-title">Applicable quality rules</h3>
                <div className="tag-list">
                  {selected.rules.map((rule) => (
                    <Badge key={rule.code}>{rule.name}</Badge>
                  ))}
                </div>
                {user.permissions.includes("governance:write") && (
                  <div className="form-actions">
                    <Button onClick={() => setEditing(true)}>
                      <Pencil size={15} />
                      Edit policy
                    </Button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </Dialog>
    </>
  );
}
