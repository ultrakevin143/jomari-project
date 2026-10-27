export class ApiFailure extends Error {
  constructor(
    public status: number,
    message: string,
    public code: string,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiFailure(
      response.status,
      body?.error?.details
        ?.map(
          (d: { field: string; message: string }) => `${d.field}: ${d.message}`,
        )
        .join("; ") ||
        body?.error?.message ||
        "The server is unavailable. Check that the API is running.",
      body?.error?.code || "NETWORK_ERROR",
    );
  return body as T;
}
export const fetcher = <T>(key: string) => api<T>(key);
export const post = <T>(path: string, body: unknown = {}) =>
  api<T>(path, { method: "POST", body: JSON.stringify(body) });
