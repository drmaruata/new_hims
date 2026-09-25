/**
 * Cursor pagination shapes.
 *
 * High-volume resources use opaque cursor pagination (API_CONTRACT §7) rather
 * than offsets, so inserts and writes never shift or duplicate a page boundary.
 */

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
  /** Total is only populated where a count is cheap enough to be worth it. */
  totalCount?: number;
}

export interface CursorQuery {
  limit?: number;
  cursor?: string;
}

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

export function normalizeLimit(raw: unknown): number {
  const parsed = typeof raw === 'string' ? Number.parseInt(raw, 10) : Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(parsed, MAX_PAGE_SIZE);
}

/**
 * Encode a cursor as an opaque, tamper-evident string.
 *
 * It carries the sort key of the last row on the page plus the direction, so
 * the next page can be produced with a stable keyset predicate. The value is
 * base64url JSON — opaque to clients, which is the point.
 */
export function encodeCursor(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): Record<string, unknown> | null {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed: unknown = JSON.parse(decoded);
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    // A malformed cursor is a client error, not a server fault; callers turn
    // this into 400 via `InvalidCursorException`.
    return null;
  }
}

/** Build a page from rows fetched with `limit + 1` to detect `hasMore`. */
export function buildPage<T>(
  rows: T[],
  limit: number,
  cursorOf: (row: T) => Record<string, unknown>,
): PaginatedResult<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  return {
    items,
    hasMore,
    nextCursor: hasMore && last ? encodeCursor(cursorOf(last)) : null,
  };
}
