import { z } from "zod";

export const uuid = z.uuid();
export const paging = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(120).default(""),
  sort: z.enum(["asc", "desc"]).default("desc"),
  status: z.string().max(40).optional(),
  severity: z.enum(["INFO", "WARNING", "ERROR"]).optional(),
});
export const paginate = (page: number, pageSize: number) => ({
  skip: (page - 1) * pageSize,
  take: pageSize,
});
export const pageResponse = (
  data: unknown[],
  total: number,
  page: number,
  pageSize: number,
) => ({
  data,
  pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) },
});
