import { beforeEach, expect, test } from "vitest";
import { db } from "@/lib/db";

let program: { id: number };
let cat: { id: number };

const course = (code: string) => ({ code, nameTh: "ก", theoryHours: 1, practiceHours: 4, credits: 3 });

beforeEach(async () => {
  program = await db.program.create({
    data: { code: "31901", level: "PVS", name: "เทคโนโลยีสารสนเทศ", typeName: "อุตสาหกรรมดิจิทัลและเทคโนโลยีสารสนเทศ" },
  });
  cat = await db.category.create({ data: { code: "1", name: "หมวด", programId: program.id } });
});

test("รหัสวิชาซ้ำไม่ได้", async () => {
  await db.course.create({ data: course("31900-0001") });
  await expect(db.course.create({ data: course("31900-0001") })).rejects.toMatchObject({ code: "P2002" });
});

test("รหัสหมวดซ้ำในสาขาเดียวไม่ได้", async () =>
  expect(db.category.create({ data: { code: "1", name: "ซ้ำ", programId: program.id } })).rejects.toMatchObject({
    code: "P2002",
  }));

test("ลบหมวดที่มีรายวิชาไม่ได้", async () => {
  await db.course.create({ data: { ...course("X"), placements: { create: { programId: program.id, categoryId: cat.id } } } });
  await expect(db.category.delete({ where: { id: cat.id } })).rejects.toMatchObject({ code: "P2003" });
});

test("ลบสาขาที่มีรายวิชาไม่ได้ ลบสาขาว่างแล้วหมวดหายตาม", async () => {
  const c = await db.course.create({
    data: { ...course("X"), placements: { create: { programId: program.id, categoryId: cat.id } } },
  });
  await expect(db.program.delete({ where: { id: program.id } })).rejects.toMatchObject({ code: "P2003" });
  await db.course.delete({ where: { id: c.id } });
  expect(await db.programCourse.count()).toBe(0);
  await db.program.delete({ where: { id: program.id } });
  expect(await db.category.count()).toBe(0);
});

test("มี extension pg_trgm", async () => {
  const rows = await db.$queryRaw<{ n: bigint }[]>`
    SELECT count(*) AS n FROM pg_extension WHERE extname = 'pg_trgm'`;
  expect(Number(rows[0].n)).toBe(1);
});
