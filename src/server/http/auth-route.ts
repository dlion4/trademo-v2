import { NextResponse } from "next/server";
import type { ZodType } from "zod";

import { MockAuthError } from "@/server/services/auth-mock-service";

/** Simulated network latency so loading states are visible in the mock. */
export const delay = (ms = 650) => new Promise((resolve) => setTimeout(resolve, ms));

export async function readJson<T>(request: Request, schema?: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new MockAuthError(400, { error: "VALIDATION_ERROR", message: "Invalid JSON body." });
  }
  if (!schema) return body as T;
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "_";
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    throw new MockAuthError(422, {
      error: "VALIDATION_ERROR",
      message: "Please fix the highlighted fields.",
      fieldErrors,
    });
  }
  return parsed.data;
}

/** Success → bare JSON (matches spec payloads); MockAuthError → status + error body. */
export async function handle<T>(fn: () => Promise<T> | T, status = 200) {
  try {
    await delay();
    return NextResponse.json(await fn(), { status });
  } catch (error) {
    if (error instanceof MockAuthError) return NextResponse.json(error.body, { status: error.status });
    console.error("[auth]", error);
    return NextResponse.json({ error: "UNKNOWN", message: "Unexpected server error." }, { status: 500 });
  }
}
