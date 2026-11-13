import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import type { Extracted } from "../scripts/pdf/parse";
import type { ProgramEntry } from "./program-registry";

const UNCATEGORISED = { code: "NONE", name: "ยังไม่จัดหมวด" };

/** Course content compared and filled between programs that share a course. */
const CONTENT_FIELDS = [
  "nameTh",
  "nameEn",
  "theoryHours",
  "practiceHours",
  "credits",
  "standardRef",
  "learningOutcome",
  "objectives",
  "competencies",
  "description",
] as const;
type ContentField = (typeof CONTENT_FIELDS)[number];
type Content = Record<ContentField, string | number | null>;

export type SeedSummary = {
  /** Courses that did not exist yet; this program becomes their owner. */
  created: number;
  /** Courses owned by this program whose content was refreshed. */
  updated: number;
  /** Existing courses owned by another program (or none) that this program also uses. */
  shared: number;
  /** Shared courses that had at least one empty field filled from this program. */
  filled: number;
  /** Shared courses with at least one field that differs from this program's booklet. */
  conflicts: number;
  /** Owned courses left alone because they were edited on the website. */
  skipped: number;
};

const normalise = (v: string | number | null): string => (v === null ? "" : String(v).replace(/\s+/g, " ").trim());
const isEmpty = (v: string | number | null) => normalise(v) === "";

const conflictLabel = (programCode: string) => `เนื้อหาต่างจากหลักสูตร ${programCode}`;

/** Adds this program's conflict note, or replaces the one a previous run left, so re-seeding never repeats it. */
function withConflictNote(note: string | null, programCode: string, fields: ContentField[]): string {
  const entry = `${conflictLabel(programCode)}: ${fields.join(", ")}`;
  const previous = new RegExp(`${conflictLabel(programCode)}: [A-Za-z]+(?:, [A-Za-z]+)*`);
  if (note && previous.test(note)) return note.replace(previous, entry);
  return note ? `${note}; ${entry}` : entry;
}

/**
 * Loads one program's extracted curriculum data. Safe to re-run: rows are matched by code.
 * - The program, its categories and its placements are created only when missing (they may have been edited on the website) unless `force`.
 * - A new course is owned by this program. The owner refreshes its content unless the course was edited on the website (and not `force`).
 * - A course owned by another program (or no program) only gets its empty fields filled; fields that differ are left alone and flagged.
 * - Courses no longer in the booklet are never deleted.
 */
export async function seedFromExtracted(
  db: PrismaClient,
  program: ProgramEntry,
  data: Extracted,
  opts: { force?: boolean; sortOrder?: number } = {},
): Promise<SeedSummary> {
  // Programs, categories and placements carry no edit stamp, so any existing row may have been changed on the website.
  // sortOrder is the program's position in the registry file.
  const programFields = {
    level: program.level,
    name: program.name,
    typeName: program.typeName,
    sortOrder: opts.sortOrder ?? 0,
  };
  const { id: programId } = await db.program.upsert({
    where: { code: program.code },
    create: { code: program.code, ...programFields },
    update: opts.force ? programFields : {},
  });

  const categoryIds = new Map<string, number>();
  // Parents first, so every child can point at an existing row.
  const byDepth = [...data.categories].sort(
    (a, b) => a.code.split(".").length - b.code.split(".").length,
  );
  for (const cat of byDepth) {
    const fields = {
      name: cat.name,
      minCredits: cat.minCredits,
      sortOrder: cat.sortOrder,
      parentId: cat.parentCode ? (categoryIds.get(cat.parentCode) ?? null) : null,
    };
    const row = await db.category.upsert({
      where: { programId_code: { programId, code: cat.code } },
      create: { programId, code: cat.code, ...fields },
      update: opts.force ? fields : {},
    });
    categoryIds.set(cat.code, row.id);
  }

  const result: SeedSummary = { created: 0, updated: 0, shared: 0, filled: 0, conflicts: 0, skipped: 0 };
  for (const c of data.courses) {
    let categoryId = c.categoryCode ? categoryIds.get(c.categoryCode) : undefined;
    const reasons = [...c.reviewReasons];
    if (categoryId === undefined) {
      const none = await db.category.upsert({
        where: { programId_code: { programId, code: UNCATEGORISED.code } },
        create: { programId, ...UNCATEGORISED, sortOrder: 999 },
        update: {},
      });
      categoryId = none.id;
      reasons.push("ยังไม่ได้จัดหมวดวิชา");
    }

    const content = {
      nameTh: c.nameTh,
      nameEn: c.nameEn,
      theoryHours: c.theoryHours,
      practiceHours: c.practiceHours,
      credits: c.credits,
      standardRef: c.standardRef,
      learningOutcome: c.learningOutcome,
      objectives: c.objectives,
      competencies: c.competencies,
      description: c.description,
    } satisfies Content;
    const ownerFields = {
      ...content,
      needsReview: reasons.length > 0,
      reviewNote: reasons.length > 0 ? reasons.join("; ") : null,
      editedAt: null,
    } as const;

    const existing = await db.course.findUnique({ where: { code: c.code } });
    let courseId: number;
    if (!existing) {
      const created = await db.course.create({
        data: { code: c.code, ...ownerFields, sourceProgramCode: program.code },
      });
      courseId = created.id;
      result.created++;
    } else if (
      existing.sourceProgramCode === program.code ||
      // No owner and never edited on the website: seeded before owners existed (the migration could only
      // tell from sourcePage, which some booklet rows lack). Web-created courses always carry editedAt.
      (existing.sourceProgramCode === null && existing.editedAt === null)
    ) {
      courseId = existing.id;
      if (existing.editedAt && !opts.force) {
        result.skipped++;
      } else {
        await db.course.update({
          where: { id: existing.id },
          data: { ...ownerFields, sourceProgramCode: program.code },
        });
        result.updated++;
      }
    } else {
      // Another program owns this course: never overwrite, only fill gaps and flag differences.
      courseId = existing.id;
      result.shared++;
      const fill: Partial<Content> = {};
      const differing: ContentField[] = [];
      for (const field of CONTENT_FIELDS) {
        const mine = content[field];
        const theirs = existing[field];
        if (isEmpty(mine)) continue;
        if (isEmpty(theirs)) fill[field] = mine;
        else if (normalise(mine) !== normalise(theirs)) differing.push(field);
      }
      const update: Record<string, unknown> = { ...fill };
      if (differing.length > 0) {
        update.needsReview = true;
        update.reviewNote = withConflictNote(existing.reviewNote, program.code, differing);
      }
      if (Object.keys(update).length > 0) await db.course.update({ where: { id: existing.id }, data: update });
      if (Object.keys(fill).length > 0) result.filled++;
      if (differing.length > 0) result.conflicts++;
    }

    const placement = { categoryId, sourcePage: c.sourcePage };
    await db.programCourse.upsert({
      where: { programId_courseId: { programId, courseId } },
      create: { programId, courseId, ...placement },
      update: opts.force ? placement : {},
    });
  }
  return result;
}

/** Creates the first administrator; never touches an existing account. */
export async function ensureAdmin(db: PrismaClient, email: string, password: string): Promise<void> {
  const normalised = email.trim().toLowerCase();
  if (await db.user.findUnique({ where: { email: normalised } })) return;
  await db.user.create({
    data: {
      email: normalised,
      name: "ผู้ดูแลระบบ",
      role: "ADMIN",
      passwordHash: await bcrypt.hash(password, 10),
    },
  });
}
