import { Prisma, type Level } from "@prisma/client";
import type { ActionResult } from "./authz";
import { db } from "./db";
import { fieldErrors, programSchema } from "./validation";

export type ProgramSummary = {
  id: number;
  code: string;
  level: Level;
  name: string;
  typeName: string;
  sortOrder: number;
  courseCount: number;
};

const summarySelect = {
  id: true,
  code: true,
  level: true,
  name: true,
  typeName: true,
  sortOrder: true,
  _count: { select: { courses: true } },
} satisfies Prisma.ProgramSelect;

const toSummary = ({ _count, ...p }: Prisma.ProgramGetPayload<{ select: typeof summarySelect }>): ProgramSummary => ({
  ...p,
  courseCount: _count.courses,
});

export async function listPrograms(): Promise<ProgramSummary[]> {
  const rows = await db.program.findMany({
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    select: summarySelect,
  });
  return rows.map(toSummary);
}

export async function getProgramByCode(code: string): Promise<ProgramSummary | null> {
  if (!/^\d{5}$/.test(code)) return null;
  const row = await db.program.findUnique({ where: { code }, select: summarySelect });
  return row && toSummary(row);
}

export function levelLabel(level: Level): "ปวช." | "ปวส." {
  return level === "PVC" ? "ปวช." : "ปวส.";
}

const GONE: ActionResult = { ok: false, errors: { _: "ไม่พบข้อมูล อาจถูกลบไปแล้ว" } };
const fail = (field: string, message: string): ActionResult => ({ ok: false, errors: { [field]: message } });
const prismaCode = (err: unknown) => (err instanceof Prisma.PrismaClientKnownRequestError ? err.code : null);

/** Creates a program, or edits every field but its code (the code is what URLs and booklets refer to). */
export async function saveProgram(id: number | null, input: unknown): Promise<ActionResult> {
  try {
    if (id === null) {
      const parsed = programSchema.safeParse(input);
      if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
      await db.program.create({ data: parsed.data });
    } else {
      // omit() drops any code that was sent along.
      const parsed = programSchema.omit({ code: true }).safeParse(input);
      if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
      await db.program.update({ where: { id }, data: parsed.data });
    }
  } catch (err) {
    if (prismaCode(err) === "P2002") return fail("code", "รหัสสาขานี้มีอยู่แล้ว");
    if (prismaCode(err) === "P2025") return GONE;
    throw err;
  }
  return { ok: true };
}

/** Deletes a program with no courses, together with its categories. */
export async function deleteProgram(id: number): Promise<ActionResult> {
  const courses = await db.programCourse.count({ where: { programId: id } });
  if (courses > 0) return fail("_", `ลบไม่ได้: ยังมี ${courses} วิชาในสาขานี้`);
  try {
    await db.$transaction(async (tx) => {
      // Category parents are Restrict, so detach the tree before deleting it.
      await tx.category.updateMany({ where: { programId: id }, data: { parentId: null } });
      await tx.category.deleteMany({ where: { programId: id } });
      await tx.program.delete({ where: { id } });
    });
  } catch (err) {
    if (prismaCode(err) === "P2025") return GONE;
    // A course was placed in the program meanwhile.
    if (prismaCode(err) === "P2003") return fail("_", "ลบไม่ได้: ยังมีวิชาในสาขานี้");
    throw err;
  }
  return { ok: true };
}
