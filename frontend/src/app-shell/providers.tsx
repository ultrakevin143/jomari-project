"use client";
import { fetcher } from "@/shared/api/client";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
const settings = {
  fetcher,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  revalidateIfStale: false,
  refreshInterval: 0,
  dedupingInterval: 60000,
  shouldRetryOnError: false,
  errorRetryCount: 0,
};
export function WorkspaceProviders({ children }: { children: ReactNode }) {
  return <SWRConfig value={settings}>{children}</SWRConfig>;
}
