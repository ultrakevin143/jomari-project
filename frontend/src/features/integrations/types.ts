export type Source = {
  id: string;
  name: string;
  code: string;
  entity: string;
  domain: string;
  method: string;
  freshnessHours: number;
  lastSuccessAt: string | null;
  connections: {
    adapter: string;
    enabled: boolean;
  }[];
  runs: Run[];
};
export type Run = {
  id: string;
  sourceSystemId: string;
  sourceSystem?: {
    name: string;
    code: string;
  };
  entity: string;
  method: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  totalRecords: number;
  processed: number;
  failed: number;
  skipped: number;
  initiatedBy: string;
  errors?: ImportError[];
};
export type ImportError = {
  id: string;
  runId: string;
  message: string;
  code: string;
  remediation: string;
  attempts: number;
  rawRecord: {
    rowNumber: number;
    sourceRecordId: string;
    payload: Record<string, unknown>;
  };
};
