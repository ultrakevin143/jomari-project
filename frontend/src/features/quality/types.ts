export type QualityRule = {
  id: string;
  code: string;
  name: string;
  domain: string;
  entity: string;
  severity: string;
  description: string;
  active: boolean;
  config: Record<string, unknown>;
};
export type QualityResult = {
  id: string;
  rule: QualityRule;
  checked: number;
  failed: number;
  passed: boolean;
  severity: string;
  remediation: string;
  remediationNote: string | null;
  samples: {
    id: string;
    reason: string;
  }[];
};
export type QualityRun = {
  id: string;
  score: number;
  checked: number;
  failed: number;
  startedAt: string;
  finishedAt: string;
  status: string;
  domains: {
    domain: string;
    checked: number;
    failed: number;
    score: number;
  }[];
  results: QualityResult[];
  formula: string;
};
