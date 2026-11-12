import type { Course, Prisma } from "@prisma/client";
import { PAGE_SIZE, type CourseFilter } from "./course-filter";
import { db } from "./db";

export { PAGE_SIZE, filterToQuery, parseFilter, type CourseFilter } from "./course-filter";

export type CourseListItem = {
  id: number;
  code: string;
  nameTh: string;
  nameEn: string;
  theoryHours: number;
  practiceHours: number;
  credits: number;
  categoryName: string;
  needsReview: boolean;
};

export type CategoryNode = {
  id: number;
  code: string;
  name: string;
  minCredits: number | null;
  parentId: number | null;
  depth: number;
  /** Includes courses of all sub-categories. */
  courseCount: number;
};

type CategoryRow = { id: number; code: string; name: string; minCredits: number | null; parentId: number | null };

/** Categories depth-first in display order, each with its depth. */
async function categoryTree(): Promise<(CategoryRow & { depth: number })[]> {
  const rows = await db.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    select: { id: true, code: true, name: true, minCredits: true, parentId: true },
  });
  const ids = new Set(rows.map((r) => r.id));
  const out: (CategoryRow & { depth: number })[] = [];
  const visit = (parentId: number | null, depth: number) => {
    for (const r of rows) {
      const isChild = parentId === null ? r.parentId === null || !ids.has(r.parentId) : r.parentId === parentId;
      if (isChild) {
        out.push({ ...r, depth });
        visit(r.id, depth + 1);
      }
    }
  };
  visit(null, 0);
  return out;
}

/** The category itself plus every descendant. */
function withDescendants(tree: (CategoryRow & { depth: number })[], id: number): number[] {
  const start = tree.findIndex((c) => c.id === id);
  if (start === -1) return [];
  const result = [id];
  for (let i = start + 1; i < tree.length && tree[i].depth > tree[start].depth; i++) result.push(tree[i].id);
  return result;
}

// Prisma passes the search text into LIKE unescaped; keep %, _ and \ literal.
const escapeLike = (s: string) => s.replace(/[\\%_]/g, "\\$&");

async function buildWhere(f: CourseFilter): Promise<Prisma.CourseWhereInput> {
  const where: Prisma.CourseWhereInput = {};
  if (f.q) {
    const contains = { contains: escapeLike(f.q), mode: "insensitive" as const };
    where.OR = [{ code: contains }, { nameTh: contains }, { nameEn: contains }, { description: contains }];
  }
  if (f.categoryId !== null) where.categoryId = { in: withDescendants(await categoryTree(), f.categoryId) };
  if (f.credits !== null) where.credits = f.credits;
  return where;
}

const listSelect = {
  id: true,
  code: true,
  nameTh: true,
  nameEn: true,
  theoryHours: true,
  practiceHours: true,
  credits: true,
  needsReview: true,
  category: { select: { name: true } },
} satisfies Prisma.CourseSelect;

const toListItem = ({
  category,
  ...c
}: Prisma.CourseGetPayload<{ select: typeof listSelect }>): CourseListItem => ({
  ...c,
  categoryName: category.name,
});

export async function searchCourses(
  f: CourseFilter,
  extra: Prisma.CourseWhereInput = {},
): Promise<{ items: CourseListItem[]; total: number; page: number; pageCount: number }> {
  const where = { AND: [await buildWhere(f), extra] };
  const total = await db.course.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(f.page, pageCount);
  const rows = await db.course.findMany({
    where,
    orderBy: { code: "asc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: listSelect,
  });
  return { items: rows.map(toListItem), total, page, pageCount };
}

/** Every course matching the filter, ignoring `page` — for export and print. */
export async function allMatchingCourses(f: CourseFilter): Promise<CourseListItem[]> {
  const rows = await db.course.findMany({
    where: await buildWhere(f),
    orderBy: { code: "asc" },
    select: listSelect,
  });
  return rows.map(toListItem);
}

export async function getCourseByCode(
  code: string,
): Promise<(Course & { path: { code: string; name: string }[] }) | null> {
  const course = await db.course.findUnique({ where: { code: code.trim() } });
  if (!course) return null;
  const tree = await categoryTree();
  const path: { code: string; name: string }[] = [];
  for (let c = tree.find((t) => t.id === course.categoryId); c; c = tree.find((t) => t.id === c!.parentId)) {
    path.unshift({ code: c.code, name: c.name });
    if (path.length > tree.length) break; // defensive: malformed parent loop
  }
  return { ...course, path };
}

type Totals = { courses: number; credits: number };

/** Per-category totals with every sub-category rolled up into its ancestors. */
async function rolledUpTotals(tree: (CategoryRow & { depth: number })[]): Promise<Map<number, Totals>> {
  const groups = await db.course.groupBy({ by: ["categoryId"], _count: { _all: true }, _sum: { credits: true } });
  const own = new Map(groups.map((g) => [g.categoryId, { courses: g._count._all, credits: g._sum.credits ?? 0 }]));
  const totals = new Map<number, Totals>();
  for (const cat of tree) {
    const t = { courses: 0, credits: 0 };
    for (const id of withDescendants(tree, cat.id)) {
      t.courses += own.get(id)?.courses ?? 0;
      t.credits += own.get(id)?.credits ?? 0;
    }
    totals.set(cat.id, t);
  }
  return totals;
}

export async function listCategories(): Promise<CategoryNode[]> {
  const tree = await categoryTree();
  const totals = await rolledUpTotals(tree);
  return tree.map((c) => ({ ...c, courseCount: totals.get(c.id)!.courses }));
}

/** Distinct credit values in use, for the credits filter. */
export async function listCreditValues(): Promise<number[]> {
  const rows = await db.course.findMany({ distinct: ["credits"], select: { credits: true }, orderBy: { credits: "asc" } });
  return rows.map((r) => r.credits);
}

export async function getStats(): Promise<{
  totalCourses: number;
  byCategory: { code: string; name: string; depth: number; courses: number; credits: number; minCredits: number | null }[];
  byCredits: { credits: number; courses: number }[];
  hours: { theory: number; practice: number };
}> {
  const tree = await categoryTree();
  const totals = await rolledUpTotals(tree);
  const [totalCourses, byCredits, sums] = await Promise.all([
    db.course.count(),
    db.course.groupBy({ by: ["credits"], _count: { _all: true }, orderBy: { credits: "asc" } }),
    db.course.aggregate({ _sum: { theoryHours: true, practiceHours: true } }),
  ]);
  return {
    totalCourses,
    byCategory: tree.map((c) => ({
      code: c.code,
      name: c.name,
      depth: c.depth,
      minCredits: c.minCredits,
      ...totals.get(c.id)!,
    })),
    byCredits: byCredits.map((g) => ({ credits: g.credits, courses: g._count._all })),
    hours: { theory: sums._sum.theoryHours ?? 0, practice: sums._sum.practiceHours ?? 0 },
  };
}
