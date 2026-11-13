import type { Level, Prisma } from "@prisma/client";
import { db } from "./db";

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
