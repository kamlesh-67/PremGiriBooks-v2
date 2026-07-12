import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { LOGO_ALLOWED_MIME_TYPES, LOGO_MAX_FILE_SIZE_BYTES } from "@/constants/company";
import { sanitizeSvg } from "@/modules/company/services/svg-sanitizer";

const LOGO_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "logos");
const LOGO_PUBLIC_PATH_PREFIX = "/uploads/logos";

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/svg+xml": ".svg",
};

export async function saveCompanyLogo(file: File): Promise<string> {
  if (!LOGO_ALLOWED_MIME_TYPES.includes(file.type as (typeof LOGO_ALLOWED_MIME_TYPES)[number])) {
    throw new Error("Logo must be a PNG, JPG, JPEG, or SVG file.");
  }

  if (file.size > LOGO_MAX_FILE_SIZE_BYTES) {
    throw new Error("Logo must be smaller than 5 MB.");
  }

  await mkdir(LOGO_UPLOAD_DIR, { recursive: true });

  const fileName = `${randomUUID()}${EXTENSION_BY_MIME_TYPE[file.type]}`;
  let buffer = Buffer.from(await file.arrayBuffer());

  if (file.type === "image/svg+xml") {
    buffer = Buffer.from(sanitizeSvg(buffer.toString("utf-8")), "utf-8");
  }

  await writeFile(path.join(LOGO_UPLOAD_DIR, fileName), buffer);

  return `${LOGO_PUBLIC_PATH_PREFIX}/${fileName}`;
}
