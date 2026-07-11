import type {
  Business, ScoreResponse, Recommendation, CompetitorRow, Paginated,
} from "@answerspot/shared-types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export class ApiError extends Error {
  constructor(message: string, public status: number, public body?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  if (typeof window === "undefined") {
    const { cookies } = await import("next/headers");
    const token = cookies().get("session")?.value;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
  return {};
}

interface RequestOpts {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  cache?: RequestCache;
  next?: { revalidate?: number; tags?: string[] };
}

export async function apiFetch<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(await authHeaders()),
  };
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: "include",
    cache: opts.cache ?? "no-store",
    next: opts.next,
  });
  if (!res.ok) {
    let body: unknown;
    try { body = await res.json(); } catch { /* non-JSON error */ }
    const msg =
      res.status === 401 ? "unauthorized"
      : res.status === 403 ? "forbidden"
      : res.status === 404 ? "not_found"
      : `request_failed_${res.status}`;
    throw new ApiError(msg, res.status, body);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  business: {
    get: (id: string) => apiFetch<Business>(`/businesses/${id}`),
    list: (page = 1, limit = 20) =>
      apiFetch<Paginated<Business>>(`/businesses?page=${page}&limit=${limit}`),
    create: (input: Pick<Business, "name" | "category" | "city" | "state"> & { website?: string }) =>
      apiFetch<Business>(`/businesses`, { method: "POST", body: input }),
    score: (id: string) => apiFetch<ScoreResponse>(`/businesses/${id}/visibility-score`),
    recommendations: (id: string) =>
      apiFetch<Recommendation[]>(`/businesses/${id}/recommendations`),
    competitors: (id: string) =>
      apiFetch<CompetitorRow[]>(`/businesses/${id}/competitors`),
  },
  scans: {
    trigger: (trackedQueryId: string, platformKeys?: string[]) =>
      apiFetch<{ queued: boolean }>(`/scans/trigger`, {
        method: "POST", body: { trackedQueryId, platformKeys },
      }),
  },
};
