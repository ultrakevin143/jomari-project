"use client";

import {
  Activity,
  BarChart3,
  FileClock,
  LayoutDashboard,
  ShieldCheck,
  Truck,
  UsersRound,
  Workflow,
} from "lucide-react";

export const navigation = [
  {
    href: "/overview",
    title: "Overview",
    icon: LayoutDashboard,
    permission: "operations:read",
  },
  {
    href: "/operations/routes",
    title: "Operations",
    icon: Truck,
    permission: "operations:read",
  },
  {
    href: "/integrations",
    title: "Integrations",
    icon: Workflow,
    permission: "integrations:read",
  },
  {
    href: "/reliability",
    title: "Collection reliability",
    icon: Activity,
    permission: "reports:read",
  },
  {
    href: "/quality",
    title: "Data quality",
    icon: Activity,
    permission: "dq:read",
  },
  {
    href: "/governance",
    title: "Governance",
    icon: ShieldCheck,
    permission: "governance:read",
  },
  {
    href: "/reports",
    title: "Reports",
    icon: BarChart3,
    permission: "reports:read",
  },
  {
    href: "/audit",
    title: "Audit log",
    icon: FileClock,
    permission: "audit:read",
  },
  {
    href: "/users",
    title: "Users",
    icon: UsersRound,
    permission: "operations:read",
    adminOnly: true,
  },
];
