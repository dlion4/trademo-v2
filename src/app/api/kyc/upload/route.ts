import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** POST /api/kyc/upload — mock pre-signed upload (multipart). Real: S3 presign. */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const slot = String(form?.get("slot") ?? "doc");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "VALIDATION_ERROR", message: "No file received." }, { status: 422 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "VALIDATION_ERROR", message: "Max file size is 10 MB." }, { status: 413 });
  }
  const safe = file.name.replace(/[^a-z0-9._-]/gi, "-").toLowerCase();
  const fileKey = `user_demo/${slot}-${Date.now().toString(36)}-${safe}`;
  return NextResponse.json({ fileKey, url: `s3://trademo-kyc/${fileKey}`, sizeBytes: file.size, contentType: file.type });
}
