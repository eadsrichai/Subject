import { Prisma } from "@prisma/client";
import type { ActionResult } from "./authz";
import { db } from "./db";
import { categorySchema, courseSchema, fieldErrors } from "./validation";

// Editing rules for courses and categories. Authorisation happens in the
// server actions that call these; everything here is safe to unit-test.

const GONE: ActionResult = { ok: false, errors: { _: "ไม่พบข้อมูล อาจถูกลบไปแล้ว" } };
const fail = (field: string, message: string): ActionResult => ({ ok: false, errors: { [field]: message } });

const prismaCode = (err: unknown) => (err instanceof Prisma.PrismaClientKnownRequestError ? err.code : null);
const UNIQUE = "P2002";
const NOT_FOUND = "P2025";
const STILL_REFERENCED = "P2003";

/** Per-row errors for the course form's placements, or null when every row is valid. */
async function checkPlacements(
  placements: { programId: number; categoryId: number }[],
): Promise<Record<string, string> | null> {
  const [programs, categories] = await Promise.all([
    db.program.findMany({ where: { id: { in: placements.map((p) => p.programId) } }, select: { id: true } }),
    db.category.findMany({
      where: { id: { in: placements.map((p) => p.categoryId) } },
      select: { id: true, programId: true },
    }),
  ]);
  const programIds = new Set(programs.map((p) => p.id));
  const programOfCategory = new Map(categories.map((c) => [c.id, c.programId]));
  const errors: Record<string, string> = {};
  const seen = new Set<number>();
  placements.forEach((p, i) => {
    if (seen.has(p.programId)) errors[`placements.${i}.programId`] = "เลือกสาขานี้ซ้ำ";
    else if (!programIds.has(p.programId)) errors[`placements.${i}.programId`] = "ไม่พบสาขาที่เลือก";
    else if (programOfCategory.get(p.categoryId) !== p.programId)
      errors[`placements.${i}.categoryId`] = "หมวดนี้ไม่ได้อยู่ในสาขาที่เลือก";
    seen.add(p.programId);
  });
  return Object.keys(errors).length > 0 ? errors : null;
}

export async function saveCourse(id: number | null, input: unknown): Promise<ActionResult> {
  const parsed = courseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const { needsReview, placements, ...fields } = parsed.data;

  const placementErrors = await checkPlacements(placements);
  if (placementErrors) return { ok: false, errors: placementErrors };

  try {
    await db.$transaction(async (tx) => {
      const course =
        id === null
          ? await tx.course.create({ data: { ...fields, needsReview, editedAt: new Date() } })
          : await tx.course.update({
              where: { id },
              // Clearing the flag also drops the importer's note; keeping it keeps the note.
              data: { ...fields, needsReview, ...(needsReview ? {} : { reviewNote: null }), editedAt: new Date() },
            });
      // The form's rows replace the course's whole set of placements; a program it stays in keeps its booklet page.
      const previous = await tx.programCourse.findMany({
        where: { courseId: course.id },
        select: { programId: true, sourcePage: true },
      });
      const pageOf = new Map(previous.map((p) => [p.programId, p.sourcePage]));
      await tx.programCourse.deleteMany({ where: { courseId: course.id } });
      await tx.programCourse.createMany({
        data: placements.map((p) => ({ ...p, courseId: course.id, sourcePage: pageOf.get(p.programId) ?? null })),
      });
    });
  } catch (err) {
    if (prismaCode(err) === UNIQUE) return fail("code", "รหัสวิชานี้มีอยู่แล้ว");
    if (prismaCode(err) === NOT_FOUND) return GONE;
    // A chosen program or category was deleted after the check above.
    if (prismaCode(err) === STILL_REFERENCED) return fail("_", "สาขาหรือหมวดที่เลือกถูกลบไปแล้ว กรุณาเลือกใหม่");
    throw err;
  }
  return { ok: true };
}

export async function deleteCourse(id: number): Promise<ActionResult> {
  try {
    await db.course.delete({ where: { id } });
  } catch (err) {
    if (prismaCode(err) === NOT_FOUND) return GONE;
    throw err;
  }
  return { ok: true };
}

/** True if `candidateId` is `id` itself or sits anywhere below it. */
async function isSelfOrDescendant(id: number, candidateId: number): Promise<boolean> {
  const all = await db.category.findMany({ select: { id: true, parentId: true } });
  const parentOf = new Map(all.map((c) => [c.id, c.parentId]));
  let current: number | null | undefined = candidateId;
  for (let hops = 0; current != null && hops <= all.length; hops++) {
    if (current === id) return true;
    current = parentOf.get(current);
  }
  return false;
}

export async function saveCategory(id: number | null, input: unknown): Promise<ActionResult> {
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const { programId: requestedProgramId, ...data } = parsed.data;

  // A category never moves between programs: an existing one keeps its own.
  let programId = requestedProgramId;
  if (id !== null) {
    const existing = await db.category.findUnique({ where: { id }, select: { programId: true } });
    if (!existing) return GONE;
    programId = existing.programId;
  } else if (!(await db.program.findUnique({ where: { id: programId }, select: { id: true } }))) {
    return fail("programId", "ไม่พบสาขาที่เลือก");
  }

  if (data.parentId !== null) {
    const parent = await db.category.findUnique({ where: { id: data.parentId }, select: { programId: true } });
    if (!parent || parent.programId !== programId || (id !== null && (await isSelfOrDescendant(id, data.parentId)))) {
      return fail("parentId", "เลือกหมวดแม่ไม่ถูกต้อง");
    }
  }

  try {
    if (id === null) await db.category.create({ data: { ...data, programId } });
    else await db.category.update({ where: { id }, data });
  } catch (err) {
    if (prismaCode(err) === UNIQUE) return fail("code", "รหัสหมวดนี้มีอยู่แล้ว");
    if (prismaCode(err) === NOT_FOUND) return GONE;
    throw err;
  }
  return { ok: true };
}

export async function deleteCategory(id: number): Promise<ActionResult> {
  const blocked = fail("_", "ลบไม่ได้: ยังมีรายวิชาหรือหมวดย่อยอยู่");
  const [courses, children] = await Promise.all([
    db.programCourse.count({ where: { categoryId: id } }),
    db.category.count({ where: { parentId: id } }),
  ]);
  if (courses > 0 || children > 0) return blocked;
  try {
    await db.category.delete({ where: { id } });
  } catch (err) {
    if (prismaCode(err) === NOT_FOUND) return GONE;
    if (prismaCode(err) === STILL_REFERENCED) return blocked; // something was added meanwhile
    throw err;
  }
  return { ok: true };
}
