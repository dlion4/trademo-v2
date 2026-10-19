import type { ApiEnvelope } from "./types";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * Thin transport wrapper. Every backend call goes through here so the base URL,
 * auth headers and error handling only ever change in one place.
 */
export async function apiFetch<TData>(path: string, init?: RequestInit): Promise<TData> {
  const response = await fetch(path, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload?.error) message = payload.error;
    } catch {
      /* keep default message */
    }
    throw new ApiError(message, response.status);
  }

  const payload = (await response.json()) as ApiEnvelope<TData> | TData;

  // Support both enveloped ({ data, meta }) and bare responses so a future
  // backend can drop the envelope without touching call sites.
  if (payload && typeof payload === "object" && "data" in payload && "meta" in payload) {
    return (payload as ApiEnvelope<TData>).data;
  }

  return payload as TData;
}

export function postJson<TData>(path: string, body: unknown): Promise<TData> {
  return apiFetch<TData>(path, { method: "POST", body: JSON.stringify(body) });
}
