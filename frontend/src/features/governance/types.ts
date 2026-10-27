export type Asset = {
  id: string;
  name: string;
  entity: string;
  owner: string;
  steward: string;
  classification: string;
  containsPii: boolean;
  retentionDays: number;
  policy: string;
  version: number;
  domain: {
    name: string;
    code: string;
  };
  sourceSystem: {
    name: string;
    method: string;
  };
  rules: {
    code: string;
    name: string;
  }[];
};
