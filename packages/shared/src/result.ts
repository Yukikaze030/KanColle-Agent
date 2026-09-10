/**
 * Shared result philosophy:
 *   unknown ≠ absent
 *   not_loaded ≠ count 0
 *   not_found ≠ error
 *   insufficient data ≠ guessable
 */

export type PoiResultStatus =
  | "ok"
  | "partial"
  | "stale"
  | "not_ready"
  | "not_found"
  | "unknown"
  | "error";

export type DataResultStatus =
  | "ok"
  | "not_found"
  | "partial"
  | "ambiguous"
  | "error";

export type Coverage = "complete" | "partial" | "not_loaded";

export interface SnapshotMeta {
  version: number;
  generated_at: string;
}

export interface DomainFreshness {
  domain: string;
  updated_at: string | null;
  coverage?: Coverage;
}

export interface PoiResult<T> {
  status: PoiResultStatus;
  data: T | null;
  snapshot?: SnapshotMeta;
  missing?: string[];
  warnings?: string[];
  error?: { code: string; message: string };
  cursor?: string | null;
}

export interface DataResult<T> {
  status: DataResultStatus;
  data: T | null;
  missing?: string[];
  candidates?: Array<{ ref: string; name: string; type: string; score?: number }>;
  warnings?: string[];
  error?: { code: string; message: string };
  cursor?: string | null;
}

export function okResult<T>(data: T, extra?: Partial<PoiResult<T>>): PoiResult<T> {
  return { status: "ok", data, ...extra };
}

export function poiPartial<T>(
  data: T,
  missing: string[],
  extra?: Partial<PoiResult<T>>,
): PoiResult<T> {
  return { status: "partial", data, missing, ...extra };
}

export function poiNotFound<T>(missing?: string[]): PoiResult<T> {
  return { status: "not_found", data: null, missing };
}

export function poiUnknown<T>(warnings?: string[]): PoiResult<T> {
  return { status: "unknown", data: null, warnings };
}

export function poiError<T>(code: string, message: string): PoiResult<T> {
  return { status: "error", data: null, error: { code, message } };
}

export function dataOk<T>(data: T, extra?: Partial<DataResult<T>>): DataResult<T> {
  return { status: "ok", data, ...extra };
}

export function dataNotFound<T>(warnings?: string[]): DataResult<T> {
  return { status: "not_found", data: null, warnings };
}

export function dataPartial<T>(data: T, missing: string[]): DataResult<T> {
  return { status: "partial", data, missing };
}

export function dataAmbiguous<T>(
  candidates: Array<{ ref: string; name: string; type: string; score?: number }>,
): DataResult<T> {
  return { status: "ambiguous", data: null, candidates };
}

export function dataError<T>(code: string, message: string): DataResult<T> {
  return { status: "error", data: null, error: { code, message } };
}

export interface PageCursor {
  offset: number;
  limit: number;
}

export function encodeCursor(offset: number, limit: number): string {
  return Buffer.from(JSON.stringify({ offset, limit } satisfies PageCursor)).toString(
    "base64url",
  );
}

export function decodeCursor(cursor: string | undefined | null): PageCursor {
  if (!cursor) return { offset: 0, limit: 20 };
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as PageCursor;
    return {
      offset: Math.max(0, parsed.offset | 0),
      limit: Math.min(100, Math.max(1, parsed.limit | 0 || 20)),
    };
  } catch {
    return { offset: 0, limit: 20 };
  }
}

export function paginate<T>(
  items: T[],
  limit?: number,
  cursor?: string,
): { page: T[]; cursor: string | null; total: number } {
  const decoded = decodeCursor(cursor);
  const effectiveLimit = Math.min(100, Math.max(1, limit ?? decoded.limit));
  const start = cursor ? decoded.offset : 0;
  const page = items.slice(start, start + effectiveLimit);
  const nextOffset = start + page.length;
  const next =
    nextOffset < items.length ? encodeCursor(nextOffset, effectiveLimit) : null;
  return { page, cursor: next, total: items.length };
}

/** Project only requested fields; empty/undefined fields returns full object. */
export function pickFields<T extends object>(
  obj: T,
  fields?: string[],
): Partial<T> | T {
  if (!fields || fields.length === 0) return obj;
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (f in obj) out[f] = (obj as Record<string, unknown>)[f];
  }
  return out as Partial<T>;
}

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;
