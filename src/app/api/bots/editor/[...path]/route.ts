import { readFile } from "node:fs/promises";
import path from "node:path";
export const runtime = "nodejs";
const mime: Record<string, string> = {
  ".js": "text/javascript",
  ".css": "text/css",
  ".ttf": "font/ttf",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".ts": "text/plain",
};
/** Serve only installed Monaco assets; no CDN or user-supplied filesystem access. */
export async function GET(
  _: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: parts } = await params;
  if (
    !parts.length ||
    parts.some((p) => !p || p === "." || p === ".." || !/^[\w.@-]+$/.test(p))
  )
    return new Response("Invalid asset path", { status: 400 });
  const root = path.join(process.cwd(), "node_modules/monaco-editor/min");
  const file = path.resolve(root, ...parts);
  if (!file.startsWith(root + path.sep) || !mime[path.extname(file)])
    return new Response("Asset not found", { status: 404 });
  try {
    return new Response(await readFile(file), {
      headers: {
        "Content-Type": mime[path.extname(file)],
        "Cache-Control": "public, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Asset not found", { status: 404 });
  }
}
