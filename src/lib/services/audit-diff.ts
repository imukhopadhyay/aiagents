/** Fields that changed between two records, for audit log entries. */
export function diff<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): { before: Record<string, unknown>; after: Record<string, unknown> } | null {
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  for (const key of Object.keys(after)) {
    const prev = before[key];
    const next = after[key];
    const same =
      prev instanceof Date && next instanceof Date
        ? prev.getTime() === next.getTime()
        : JSON.stringify(prev) === JSON.stringify(next);
    if (!same) {
      b[key] = prev ?? null;
      a[key] = next ?? null;
    }
  }
  return Object.keys(a).length ? { before: b, after: a } : null;
}
