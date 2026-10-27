export type Audit = {
  id: string;
  action: string;
  actorName: string;
  entity: string;
  entityId: string | null;
  requestId: string;
  reason: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};
