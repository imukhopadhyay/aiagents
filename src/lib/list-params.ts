// Parse list-page search params (search, filters, sort, pagination) and
// build links that change one of them.

export type SearchParams = Record<string, string | string[] | undefined>;

export interface ListParams<S extends string> {
  q: string;
  page: number;
  pageSize: number;
  sort: S;
  dir: "asc" | "desc";
  get(key: string): string | undefined;
  raw: Record<string, string>;
}

export function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseListParams<S extends string>(
  params: SearchParams,
  options: {
    sortable: readonly S[];
    defaultSort: S;
    defaultDir?: "asc" | "desc";
    pageSize?: number;
  },
): ListParams<S> {
  const raw: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    const v = first(value);
    if (v !== undefined && v !== "") raw[key] = v;
  }
  const sort = options.sortable.includes(raw.sort as S) ? (raw.sort as S) : options.defaultSort;
  const dir = raw.dir === "asc" || raw.dir === "desc" ? raw.dir : (options.defaultDir ?? "asc");
  const page = Math.max(1, Number.parseInt(raw.page ?? "1", 10) || 1);
  return {
    q: (raw.q ?? "").trim().slice(0, 100),
    page,
    pageSize: options.pageSize ?? 20,
    sort,
    dir,
    get: (key) => raw[key],
    raw,
  };
}

/** Href for `pathname` with `params` overridden (null removes a key). */
export function hrefWith(
  pathname: string,
  params: Record<string, string>,
  overrides: Record<string, string | number | null | undefined>,
): string {
  const next = new URLSearchParams(params);
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null || value === undefined || value === "") next.delete(key);
    else next.set(key, String(value));
  }
  const query = next.toString();
  return query ? `${pathname}?${query}` : pathname;
}
