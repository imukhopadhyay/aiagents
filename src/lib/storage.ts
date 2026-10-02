import "server-only";

import { randomBytes } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { DomainError } from "@/lib/errors";

// Local-disk storage. Keys look like "documents/2026/<random>.pdf"; the
// category prefix decides who may read the file (see /api/files).
// Swap this module for S3/GCS in production; callers only use keys.

export type FileCategory = "photos" | "documents" | "resumes";

// Uploads are runtime data, not source: tell the bundler not to trace these
// paths (otherwise it would include the whole project in the server output).
const ROOT = path.resolve(/*turbopackIgnore: true*/ process.env.STORAGE_DIR ?? "storage");
const KEY_PATTERN = /^(photos|documents|resumes)\/\d{4}\/[A-Za-z0-9_-]{16,}\.[a-z0-9]{1,5}$/;

const RULES: Record<FileCategory, { maxBytes: number; types: Record<string, string> }> = {
  photos: {
    maxBytes: 2 * 1024 * 1024,
    types: { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" },
  },
  documents: {
    maxBytes: 10 * 1024 * 1024,
    types: {
      "application/pdf": "pdf",
      "image/jpeg": "jpg",
      "image/png": "png",
      "application/msword": "doc",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
      "text/plain": "txt",
    },
  },
  resumes: {
    maxBytes: 5 * 1024 * 1024,
    types: {
      "application/pdf": "pdf",
      "application/msword": "doc",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    },
  },
};

export const MIME_BY_EXT: Record<string, string> = Object.fromEntries(
  Object.values(RULES).flatMap((rule) =>
    Object.entries(rule.types).map(([mime, ext]) => [ext, mime]),
  ),
);

export function isValidKey(key: string): boolean {
  return KEY_PATTERN.test(key);
}

export function categoryOf(key: string): FileCategory {
  return key.split("/")[0] as FileCategory;
}

export interface StoredFile {
  key: string;
  mimeType: string;
  size: number;
  name: string;
}

export async function saveFile(category: FileCategory, file: File): Promise<StoredFile> {
  const rule = RULES[category];
  const ext = rule.types[file.type];
  if (!ext) {
    throw new DomainError(
      `Unsupported file type. Allowed: ${[...new Set(Object.values(rule.types))].join(", ")}.`,
      "file",
    );
  }
  if (file.size === 0) throw new DomainError("The file is empty.", "file");
  if (file.size > rule.maxBytes) {
    throw new DomainError(`File is too large (max ${rule.maxBytes / 1024 / 1024} MB).`, "file");
  }

  const key = `${category}/${new Date().getUTCFullYear()}/${randomBytes(16).toString("base64url")}.${ext}`;
  const target = path.join(/*turbopackIgnore: true*/ ROOT, key);
  await mkdir(/*turbopackIgnore: true*/ path.dirname(target), { recursive: true });
  await writeFile(/*turbopackIgnore: true*/ target, Buffer.from(await file.arrayBuffer()));
  return { key, mimeType: file.type, size: file.size, name: file.name.slice(0, 200) };
}

function resolveKey(key: string): string {
  if (!isValidKey(key)) throw new DomainError("Invalid file key.");
  const target = path.resolve(/*turbopackIgnore: true*/ ROOT, key);
  if (!target.startsWith(ROOT + path.sep)) throw new DomainError("Invalid file key.");
  return target;
}

export async function readStoredFile(key: string): Promise<Buffer | null> {
  try {
    return await readFile(/*turbopackIgnore: true*/ resolveKey(key));
  } catch {
    return null;
  }
}

export async function deleteStoredFile(key: string | null | undefined): Promise<void> {
  if (!key || !isValidKey(key)) return;
  await rm(/*turbopackIgnore: true*/ resolveKey(key), { force: true });
}

/** Public path that serves a stored file through the access-checked route. */
export function fileUrl(key: string): string {
  return `/api/files/${key}`;
}
