import { randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/*
 * File storage seam. Local disk in dev (./uploads, gitignored), served by
 * /api/files/[id]. Swapping to an S3-compatible store means reimplementing
 * these three functions (getFileUrl would return a signed URL) — callers
 * never touch the filesystem directly.
 */

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

function safeName(filename: string): string {
  return (
    filename
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, "-")
      .replace(/^[-.]+|-+$/g, "")
      .slice(-64) || "file"
  );
}

// fileIds contain no path separators; resolve defensively anyway.
function filePath(fileId: string): string {
  const resolved = path.resolve(UPLOADS_DIR, fileId);
  if (path.dirname(resolved) !== path.resolve(UPLOADS_DIR)) {
    throw new Error("Invalid file id");
  }
  return resolved;
}

export async function saveFile(
  data: Buffer | Uint8Array,
  filename: string,
): Promise<string> {
  const fileId = `${randomBytes(8).toString("hex")}-${safeName(filename)}`;
  await mkdir(UPLOADS_DIR, { recursive: true });
  await writeFile(filePath(fileId), data);
  return fileId;
}

export function getFileUrl(fileId: string): string {
  return `/api/files/${encodeURIComponent(fileId)}`;
}

export async function deleteFile(fileId: string): Promise<void> {
  await unlink(filePath(fileId)).catch(() => {});
}

// Dev-only helper for the /api/files route; an S3 implementation serves
// files directly and never calls this.
export async function readFileData(fileId: string): Promise<Buffer> {
  return readFile(filePath(fileId));
}
