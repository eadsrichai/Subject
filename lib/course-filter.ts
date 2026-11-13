import { normalizeThai } from "./normalize-thai";

export const PAGE_SIZE = 20;
const MAX_QUERY_LENGTH = 100;

export type CourseFilter = {
  /** null = every program (cross-program search); never read from the query string. */
  programId: number | null;
  q: string;
  categoryId: number | null;
  credits: number | null;
  page: number;
};

type SearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const wholeNumber = (v: string) => (/^\d{1,9}$/.test(v) ? Number(v) : null);

/** Reads the public list's query string; anything malformed falls back to "no filter". */
export function parseFilter(sp: SearchParams): CourseFilter {
  return {
    programId: null,
    q: normalizeThai(first(sp.q)).slice(0, MAX_QUERY_LENGTH),
    categoryId: wholeNumber(first(sp.category)),
    credits: wholeNumber(first(sp.credits)),
    page: Math.max(1, wholeNumber(first(sp.page)) ?? 1),
  };
}

/** Inverse of parseFilter; omits defaults so the plain list stays at "/". */
export function filterToQuery(f: Partial<CourseFilter>): string {
  const params = new URLSearchParams();
  if (f.q) params.set("q", f.q);
  if (f.categoryId != null) params.set("category", String(f.categoryId));
  if (f.credits != null) params.set("credits", String(f.credits));
  if (f.page && f.page > 1) params.set("page", String(f.page));
  const s = params.toString();
  return s ? `?${s}` : "";
}
