import type { Course, Level, Prisma } from "@prisma/client";
import { PAGE_SIZE, type CourseFilter } from "./course-filter";
import { db } from "./db";

export { PAGE_SIZE, filterToQuery, parseFilter, type CourseFilter } from "./course-filter";

export type ProgramLabel = { code: string; level: Level; name: string };

export type CourseListItem = {
  id: number;
  code: string;
  nameTh: string;
  nameEn: string;
  theoryHours: number;
  practiceHours: number;
  credits: number;
  /** The course's category in the filtered program; null for a cross-program search. */
  categoryName: string | null;
  needsReview: boolean;
  /** Every program the course is placed in, in program order. */
  programs: ProgramLabel[];
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
type TreeNode = CategoryRow & { depth: number };

/** A program's categories depth-first in display order, each with its depth. */
async function categoryTree(programId: number): Promise<TreeNode[]> {
  const rows = await db.category.findMany({
    where: { programId },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    select: { id: true, code: true, name: true, minCredits: true, parentId: true },
  });
  const ids = new Set(rows.map((r) => r.id));
  const out: TreeNode[] = [];
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
function withDescendants(tree: TreeNode[], id: number): number[] {
  const start = tree.findIndex((c) => c.id === id);
  if (start === -1) return [];
  const result = [id];
  for (let i = start + 1; i < tree.length && tree[i].depth > tree[start].depth; i++) result.push(tree[i].id);
  return result;
}

/** Courses placed in the program (all courses when `programId` is null). */
const inProgram = (programId: number | null): Prisma.CourseWhereInput =>
  programId === null ? {} : { placements: { some: { programId } } };

// Prisma passes the search text into LIKE unescaped; keep %, _ and \ literal.
const escapeLike = (s: string) => s.replace(/[\\%_]/g, "\\$&");

async function buildWhere(f: CourseFilter): Promise<Prisma.CourseWhereInput> {
  const where: Prisma.CourseWhereInput = inProgram(f.programId);
  if (f.q) {
    const contains = { contains: escapeLike(f.q), mode: "insensitive" as const };
    where.OR = [{ code: contains }, { nameTh: contains }, { nameEn: contains }, { description: contains }];
  }
  if (f.programId !== null && f.categoryId !== null) {
    // An id outside this program (another program's category, or an old link to a
    // deleted one) is ignored rather than matching nothing.
    const ids = withDescendants(await categoryTree(f.programId), f.categoryId);
    if (ids.length > 0) where.placements = { some: { programId: f.programId, categoryId: { in: ids } } };
  }
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
  placements: {
    orderBy: [{ program: { sortOrder: "asc" } }, { program: { code: "asc" } }],
    select: {
      programId: true,
      program: { select: { code: true, level: true, name: true } },
      category: { select: { name: true } },
    },
  },
} satisfies Prisma.CourseSelect;

const toListItem =
  (programId: number | null) =>
  ({ placements, ...c }: Prisma.CourseGetPayload<{ select: typeof listSelect }>): CourseListItem => ({
    ...c,
    categoryName: placements.find((p) => p.programId === programId)?.category.name ?? null,
    programs: placements.map((p) => p.program),
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
  return { items: rows.map(toListItem(f.programId)), total, page, pageCount };
}

/** Every course matching the filter, ignoring `page` — for export and print. */
export async function allMatchingCourses(f: CourseFilter): Promise<CourseListItem[]> {
  const rows = await db.course.findMany({
    where: await buildWhere(f),
    orderBy: { code: "asc" },
    select: listSelect,
  });
  return rows.map(toListItem(f.programId));
}

export type CoursePlacement = { program: ProgramLabel; path: { code: string; name: string }[] };

export async function getCourseByCode(code: string): Promise<(Course & { placements: CoursePlacement[] }) | null> {
  const course = await db.course.findUnique({
    where: { code: code.trim() },
    include: {
      placements: {
        orderBy: [{ program: { sortOrder: "asc" } }, { program: { code: "asc" } }],
        select: { categoryId: true, programId: true, program: { select: { code: true, level: true, name: true } } },
      },
    },
  });
  if (!course) return null;
  const placements: CoursePlacement[] = [];
  for (const p of course.placements) {
    const tree = await categoryTree(p.programId);
    const path: { code: string; name: string }[] = [];
    for (let c = tree.find((t) => t.id === p.categoryId); c; c = tree.find((t) => t.id === c!.parentId)) {
      path.unshift({ code: c.code, name: c.name });
      if (path.length > tree.length) break; // defensive: malformed parent loop
    }
    placements.push({ program: p.program, path });
  }
  return { ...course, placements };
}

type Totals = { courses: number; credits: number };

/** Per-category totals of a program, with every sub-category rolled up into its ancestors. */
async function rolledUpTotals(programId: number, tree: TreeNode[]): Promise<Map<number, Totals>> {
  const rows = await db.programCourse.findMany({
    where: { programId },
    select: { categoryId: true, course: { select: { credits: true } } },
  });
  const own = new Map<number, Totals>();
  for (const r of rows) {
    const t = own.get(r.categoryId) ?? { courses: 0, credits: 0 };
    t.courses++;
    t.credits += r.course.credits;
    own.set(r.categoryId, t);
  }
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

export async function listCategories(programId: number): Promise<CategoryNode[]> {
  const tree = await categoryTree(programId);
  const totals = await rolledUpTotals(programId, tree);
  return tree.map((c) => ({ ...c, courseCount: totals.get(c.id)!.courses }));
}

/** Distinct credit values in use (in the program, or anywhere when null), for the credits filter. */
export async function listCreditValues(programId: number | null): Promise<number[]> {
  const rows = await db.course.findMany({
    where: inProgram(programId),
    distinct: ["credits"],
    select: { credits: true },
    orderBy: { credits: "asc" },
  });
  return rows.map((r) => r.credits);
}

export async function getStats(programId: number): Promise<{
  totalCourses: number;
  byCategory: { code: string; name: string; depth: number; courses: number; credits: number; minCredits: number | null }[];
  byCredits: { credits: number; courses: number }[];
  hours: { theory: number; practice: number };
}> {
  const tree = await categoryTree(programId);
  const totals = await rolledUpTotals(programId, tree);
  const where = inProgram(programId);
  const [totalCourses, byCredits, sums] = await Promise.all([
    db.course.count({ where }),
    db.course.groupBy({ by: ["credits"], where, _count: { _all: true }, orderBy: { credits: "asc" } }),
    db.course.aggregate({ where, _sum: { theoryHours: true, practiceHours: true } }),
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
