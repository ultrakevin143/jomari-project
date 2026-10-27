import { type Run } from "../integrations/types.js";
import { type Row } from "../../shared/api/contracts.js";

export type Overview = {
  organization: {
    name: string;
    timezone: string;
  };
  period: {
    from: string;
    to: string;
    timezone: string;
  };
  demoMode: boolean;
  generatedAt: string;
  totals: {
    scheduled: number;
    completed: number;
    missed: number;
    netKg: number;
    receivedKg: number;
    recoveredKg: number;
    completionPct: number | null;
    diversionPct: number | null;
    contaminationPct: number | null;
  };
  series: {
    date: string;
    scheduled: number;
    completed: number;
    missed: number;
  }[];
  sources: {
    id: string;
    name: string;
    code: string;
    method: string;
    lastSuccessAt: string | null;
    stale: boolean;
    lastRun: Run | null;
  }[];
  quality: {
    score: number;
    checked: number;
    failed: number;
    finishedAt: string;
    domains: {
      domain: string;
      score: number;
    }[];
  } | null;
  fleet: {
    status: string;
    count: number;
  }[];
  openWorkOrders: number;
  openRequests: number;
  exceptions: Row[];
};
