import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import type { Extracted } from "../scripts/pdf/parse";
import type { ProgramEntry } from "./program-registry";

const UNCATEGORISED = { code: "NONE", name: "ยังไม่จัดหมวด" };

/**
 * Loads one program's extracted curriculum data. Safe to re-run: rows are matched by code,
 * and courses edited on the website (and every existing program, category and placement)
 * are left alone unless `force`.
 */
export async function seedFromExtracted(
  db: PrismaClient,
  program: ProgramEntry,
  data: Extracted,
  opts: { force?: boolean } = {},
): Promise<{ created: number; updated: number; skipped: number }> {
  // Programs, categories and placements carry no edit stamp, so any existing row may have been changed on the website.
  const programFields = { level: program.level, name: program.name, typeName: program.typeName };
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

  const result = { created: 0, updated: 0, skipped: 0 };
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

    const fields = {
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
      sourceProgramCode: program.code,
      needsReview: reasons.length > 0,
      reviewNote: reasons.length > 0 ? reasons.join("; ") : null,
      editedAt: null,
    };

    const existing = await db.course.findUnique({ where: { code: c.code } });
    let courseId: number;
    if (!existing) {
      courseId = (await db.course.create({ data: { code: c.code, ...fields } })).id;
      result.created++;
    } else if (existing.editedAt && !opts.force) {
      courseId = existing.id;
      result.skipped++;
    } else {
      courseId = (await db.course.update({ where: { id: existing.id }, data: fields })).id;
      result.updated++;
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
