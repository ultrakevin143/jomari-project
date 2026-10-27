"use client";

import { api, post } from "@/shared/api/client";
import { type Envelope, type Page, type User } from "@/shared/api/contracts";
import {
  PageHeading,
  Pager,
  Refresh,
  SearchBox,
  State,
} from "@/shared/data-display/index";
import { dateTime } from "@/shared/lib/utils";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  Empty,
  Input,
  Label,
  Select,
  Table,
  Textarea,
} from "@/shared/ui/index";
import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { Recovery } from "./recovery";
import { QuestionReset } from "./question-reset";

export type Role = {
  id: string;
  code: string;
  name: string;
};
export type Account = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  role: Role;
  updatedAt: string;
};
export function UsersView({ user }: { user: User }) {
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [editing, setEditing] = useState<Account | "new" | null>(null),
    [recovering, setRecovering] = useState<Account | null>(null),
    [resetting, setResetting] = useState<Account | null>(null);
  const key = `/users?page=${page}&search=${encodeURIComponent(search)}`;
  const { data, error, isLoading, mutate } = useSWR<Page<Account>>(key),
    { data: roles } = useSWR<Envelope<Role[]>>("/users/roles");
  return (
    <>
      <PageHeading
        title="User management"
        description="Create workspace accounts and review access. Every change needs a recorded reason."
        action={
          <>
            <Refresh refresh={() => mutate()} />
            <Button onClick={() => setEditing("new")}>Create account</Button>
          </>
        }
      />
      {recovering && (
        <Recovery account={recovering} close={() => setRecovering(null)} />
      )}
      {resetting && (
        <QuestionReset account={resetting} close={() => setResetting(null)} />
      )}
      {editing && (
        <AccountEditor
          key={typeof editing === "string" ? editing : editing.id}
          account={editing === "new" ? null : editing}
          roles={roles?.data ?? []}
          selfId={user.id}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            mutate();
          }}
        />
      )}
      <Card>
        <CardHeader>
          <div>
            <h2>Workspace accounts</h2>
            <p>
              Deactivation preserves history and revokes sessions. Passwords are
              never displayed.
            </p>
          </div>
          <SearchBox
            placeholder="Search workspace users"
            onSearch={(value) => {
              setSearch(value);
              setPage(1);
            }}
          />
        </CardHeader>
        <State loading={isLoading} error={error} retry={() => mutate()}>
          <Table>
            <thead>
              <tr>
                <th>Name / email</th>
                <th>Role</th>
                <th>Access</th>
                <th>Last updated</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {data?.data.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>
                      {row.name}
                      {row.id === user.id ? " · You" : ""}
                    </strong>
                    <div className="small">{row.email}</div>
                  </td>
                  <td>{row.role.name}</td>
                  <td>
                    <Badge tone={row.active ? "success" : "neutral"}>
                      {row.active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td>{dateTime(row.updatedAt)}</td>
                  <td>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditing(row)}
                    >
                      Edit account
                    </Button>
                    {row.id !== user.id && row.active && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRecovering(row)}
                      >
                        Recover access
                      </Button>
                    )}
                    {row.id !== user.id && row.active && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setResetting(row)}
                      >
                        Reset security question
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          {data && !data.data.length && (
            <Empty title="No matching users">
              Change the search or create a workspace account.
            </Empty>
          )}
          {data && <Pager pagination={data.pagination} onPage={setPage} />}
        </State>
      </Card>
    </>
  );
}
export function AccountEditor({
  account,
  roles,
  selfId,
  onClose,
  onDone,
}: {
  account: Account | null;
  roles: Role[];
  selfId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [roleId, setRoleId] = useState(account?.role.id ?? ""),
    [active, setActive] = useState(account?.active ?? true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Card>
      <CardHeader>
        <div>
          <h2>
            {account ? `Edit ${account.name}` : "Create workspace account"}
          </h2>
          <p>
            {account
              ? "Role and access changes end existing sessions."
              : "Use an easy-to-remember email and a distinct password. No invitation email is sent."}
          </p>
        </div>
      </CardHeader>
      <form
        className="edit-form presentation-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          setBusy(true);
          setError("");
          try {
            const base = {
              name: String(form.get("name")),
              roleId,
              reason: String(form.get("reason")),
            };
            if (account)
              await api(`/users/${account.id}`, {
                method: "PATCH",
                body: JSON.stringify({
                  ...base,
                  active,
                  updatedAt: account.updatedAt,
                }),
              });
            else
              await post("/users", {
                ...base,
                email: String(form.get("email")),
                password: String(form.get("password")),
              });
            toast.success(account ? "Account updated" : "Account created");
            onDone();
          } catch (err) {
            setError(
              err instanceof Error
                ? err.message
                : "Account could not be saved.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="field">
          <Label htmlFor="account-name">Name</Label>
          <Input
            id="account-name"
            name="name"
            required
            minLength={2}
            maxLength={100}
            defaultValue={account?.name}
          />
        </div>
        {!account && (
          <>
            <div className="field">
              <Label htmlFor="account-email">Work email</Label>
              <Input
                id="account-email"
                name="email"
                type="email"
                required
                maxLength={254}
                autoComplete="off"
                placeholder="name@wastehub.demo"
              />
            </div>
            <div className="field">
              <Label htmlFor="account-password">Initial password</Label>
              <Input
                id="account-password"
                name="password"
                type="password"
                required
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
              />
              <p className="small">
                At least 12 characters. Share privately with the intended user.
              </p>
            </div>
          </>
        )}
        <div className="field">
          <Label>Workspace role</Label>
          <Select
            label="Workspace role"
            value={roleId}
            onValueChange={setRoleId}
            disabled={account?.id === selfId}
            options={roles.map((r) => ({ value: r.id, label: r.name }))}
          />
        </div>
        {account && (
          <div className="field">
            <Label>Account access</Label>
            <Select
              label="Account access"
              value={active ? "active" : "inactive"}
              onValueChange={(v) => setActive(v === "active")}
              disabled={account.id === selfId}
              options={[
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ]}
            />
            {account.id === selfId && (
              <p className="small">
                Another administrator must change your role or deactivate your
                account.
              </p>
            )}
          </div>
        )}
        <div className="field">
          <Label htmlFor="account-reason">Reason for this change</Label>
          <Textarea
            id="account-reason"
            name="reason"
            required
            minLength={8}
            maxLength={500}
          />
        </div>
        {error && <Alert title="Account not saved">{error}</Alert>}
        <div className="form-actions">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={busy || !roleId}>
            {busy ? "Saving…" : account ? "Save account" : "Create account"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
