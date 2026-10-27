"use client";
import { navigation } from "@/app-shell/navigation";
import { WorkspaceProviders } from "@/app-shell/providers";
import { AuditView } from "@/features/audit/audit.screen";
import { Login } from "@/features/auth/login";
import { SecuritySettings } from "@/features/auth/security-settings";
import { GovernanceView } from "@/features/governance/governance.screen";
import { IntegrationsView } from "@/features/integrations/integrations.screen";
import { OperationsView } from "@/features/operations/operations.screen";
import { OverviewView } from "@/features/overview/overview.screen";
import { QualityView } from "@/features/quality/quality.screen";
import { ReliabilityView } from "@/features/reliability/reliability.screen";
import { ReportsView } from "@/features/reports/reports.screen";
import { UsersView } from "@/features/users/users.screen";
import { ApiFailure, post } from "@/shared/api/client";
import { type Envelope, type User } from "@/shared/api/contracts";
import { Alert, Button, Sheet, Tooltip } from "@/shared/ui/index";
import {
  ArrowRight,
  CircleHelp,
  Layers3,
  LogOut,
  Menu,
  Moon,
  Recycle,
  Sun,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Toaster, toast } from "sonner";
import useSWR, { useSWRConfig } from "swr";
export function Workspace() {
  return (
    <WorkspaceProviders>
      <WorkspaceContent />
      <Toaster position="bottom-right" richColors closeButton />
    </WorkspaceProviders>
  );
}
export function WorkspaceContent() {
  const pathname = usePathname(),
    router = useRouter(),
    { mutate } = useSWRConfig();
  const { data, error, isLoading } = useSWR<Envelope<User>, ApiFailure>(
    "/auth/me",
  );
  const [menu, setMenu] = useState(false),
    [dark, setDark] = useState(false),
    [securitySettings, setSecuritySettings] = useState(false);
  if (isLoading)
    return (
      <div className="initial-loading">
        <Recycle size={28} />
        <span>Opening Waste Hub…</span>
      </div>
    );
  if (!data)
    return (
      <Login
        networkError={error?.status === 401 ? undefined : error}
        onLogin={(user) => {
          void mutate("/auth/me", user, false);
          router.replace("/overview");
        }}
      />
    );
  const user = data.data,
    section = pathname.split("/")[1] || "overview";
  const active = navigation.find((n) => n.href.split("/")[1] === section);
  const allowed = active
    ? user.permissions.includes(active.permission) &&
      (!active.adminOnly || user.roleCode === "admin")
    : section === "login";
  const sidebar = (
    <>
      <div className="brand">
        <span className="brand-mark">
          <Recycle size={23} />
        </span>
        <div>
          Waste Hub<span>OPERATIONS DATA PLATFORM</span>
        </div>
      </div>
      <div className="sidebar-workspace">
        <span className="workspace-dot" />
        <div>
          Municipal operations<small>Governed workspace</small>
        </div>
      </div>
      <div className="nav-label">WORKSPACE</div>
      <nav aria-label="Main navigation">
        {navigation
          .filter(
            (n) =>
              user.permissions.includes(n.permission) &&
              (!n.adminOnly || user.roleCode === "admin"),
          )
          .map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={
                active?.title === item.title ? "nav-item active" : "nav-item"
              }
              aria-current={active?.title === item.title ? "page" : undefined}
              onClick={() => setMenu(false)}
            >
              <item.icon size={18} />
              <span>{item.title}</span>
              {item.title === "Integrations" && (
                <span className="nav-detail">CSV / API</span>
              )}
            </Link>
          ))}
      </nav>
      <div className="sidebar-footer">
        <a
          href="/api/docs"
          target="_blank"
          rel="noreferrer"
          className="nav-item"
        >
          <CircleHelp size={17} />
          <span>API reference</span>
          <ArrowRight size={14} />
        </a>
        <div className="user-block">
          <span className="avatar">
            {user.name
              .split(" ")
              .slice(0, 2)
              .map((s) => s[0])
              .join("")}
          </span>
          <div>
            <strong>{user.name}</strong>
            <small>{user.role}</small>
          </div>
          <Tooltip text="Sign out">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Sign out"
              onClick={async () => {
                try {
                  await post("/auth/logout");
                  await mutate("/auth/me", undefined, { revalidate: false });
                  router.replace("/login");
                } catch (err) {
                  toast.error(
                    err instanceof Error ? err.message : "Could not sign out.",
                  );
                }
              }}
            >
              <LogOut size={16} />
            </Button>
          </Tooltip>
        </div>
      </div>
    </>
  );
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">{sidebar}</aside>
      <Sheet title="Workspace navigation" open={menu} onOpenChange={setMenu}>
        {sidebar}
      </Sheet>
      <div className="app-body">
        <header className="topbar">
          <div className="breadcrumbs">
            <Button
              variant="ghost"
              size="icon"
              className="mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMenu(true)}
            >
              <Menu size={21} />
            </Button>
            <Layers3 size={16} />
            <span>Workspace</span>
            <span className="crumb-separator">/</span>
            <strong>{active?.title || "Overview"}</strong>
          </div>
          <div className="topbar-actions">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSecuritySettings(true)}
            >
              Security settings
            </Button>
            <span className="quiet-label">
              <span className="manual-dot" /> On-demand updates
            </span>
            <Tooltip text={dark ? "Use light theme" : "Use dark theme"}>
              <Button
                variant="ghost"
                size="icon"
                aria-label={dark ? "Use light theme" : "Use dark theme"}
                onClick={() => {
                  setDark(!dark);
                  document.documentElement.classList.toggle("dark", !dark);
                }}
              >
                {dark ? <Sun size={17} /> : <Moon size={17} />}
              </Button>
            </Tooltip>
          </div>
        </header>
        <main id="main" className="main-content">
          {securitySettings ? (
            <SecuritySettings
              close={() => setSecuritySettings(false)}
              signedOut={() => {
                setSecuritySettings(false);
                void mutate(() => true, undefined, { revalidate: false });
                router.replace("/login");
              }}
            />
          ) : !allowed ? (
            <Alert title="Access is restricted">
              Your role cannot open this view. Choose an available view from
              navigation.
            </Alert>
          ) : (
            <>
              {(section === "overview" || section === "login") && (
                <OverviewView />
              )}
              {section === "operations" && (
                <OperationsView
                  key={`${pathname.split("/")[2]}:${pathname.split("/")[3] || ""}`}
                  entity={pathname.split("/")[2] || "routes"}
                  user={user}
                  record={pathname.split("/")[3]}
                />
              )}
              {section === "integrations" && <IntegrationsView user={user} />}
              {section === "quality" && <QualityView user={user} />}
              {section === "governance" && <GovernanceView user={user} />}
              {section === "audit" && <AuditView />}
              {section === "reports" && <ReportsView />}
              {section === "users" && <UsersView user={user} />}
              {section === "reliability" && <ReliabilityView />}
              {![
                "overview",
                "login",
                "operations",
                "integrations",
                "quality",
                "governance",
                "audit",
                "reports",
                "users",
                "reliability",
              ].includes(section) && (
                <Alert title="View not found">
                  Choose a view from the workspace navigation.
                </Alert>
              )}
            </>
          )}
        </main>
        <footer className="workspace-footer">
          <span>Waste Operations Data Hub</span>
          <span>Sources → Integration → Governance → Outputs</span>
        </footer>
      </div>
    </div>
  );
}
