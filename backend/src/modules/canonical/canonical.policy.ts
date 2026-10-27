import { type Entity } from "./canonical.schemas.js";

export const permittedEntities: Record<string, Entity[]> = {
  routes: ["routes", "collection-events"],
  vehicles: ["vehicles", "telemetry"],
  weighbridge: ["weighbridge", "facilities"],
  recycling: ["recycling"],
  "work-orders": ["work-orders"],
  contracts: ["contracts"],
  "citizen-requests": ["citizen-requests"],
};

export const allowedTransition = (from: string, to: string) =>
  from === to ||
  (
    {
      OPEN: ["ASSIGNED"],
      ASSIGNED: ["OPEN", "RESOLVED"],
      RESOLVED: ["ASSIGNED", "CLOSED"],
      CLOSED: [],
    } as Record<string, string[]>
  )[from]?.includes(to) === true;
