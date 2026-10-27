export type Envelope<T> = {
  data: T;
};
export type Page<T> = {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    pages: number;
  };
};
export type User = {
  id: string;
  name: string;
  email: string;
  organizationId: string;
  role: string;
  roleCode?: string;
  permissions: string[];
};
export type Row = Record<string, unknown> & {
  id: string;
};
