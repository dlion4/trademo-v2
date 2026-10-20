export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { ok: false, message: "Backend integration is disabled." },
    { status: 503 },
  );
}
