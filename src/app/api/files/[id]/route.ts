import { getCurrentUser } from "@/lib/auth";
import { canRead } from "@/lib/access";
import { readFileData } from "@/lib/storage";

// Uploaded files (document blocks). Same access rule as everything else:
// any signed-in employee can read.

const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  txt: "text/plain; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/files/[id]">,
) {
  const user = await getCurrentUser();
  if (!canRead(user)) {
    return new Response("Sign in to download files.", { status: 401 });
  }

  const { id } = await ctx.params;
  let data: Buffer;
  try {
    data = await readFileData(id);
  } catch {
    return new Response("Not found", { status: 404 });
  }

  // fileIds are `<random hex>-<safe filename>`; the suffix names the download.
  const filename = id.replace(/^[0-9a-f]+-/, "") || "file";
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": MIME_BY_EXT[ext] ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${filename}"`,
      // fileIds are random and content never changes under an id.
      "Cache-Control": "private, max-age=3600",
    },
  });
}
