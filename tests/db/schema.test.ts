import { expect, test } from "vitest";
import { db } from "@/lib/db";

test("รหัสวิชาซ้ำไม่ได้", async () => {
  const cat = await db.category.create({ data: { code: "1", name: "หมวด" } });
  const data = {
    code: "31900-0001",
    nameTh: "ก",
    theoryHours: 1,
    practiceHours: 4,
    credits: 3,
    categoryId: cat.id,
  };
  await db.course.create({ data });
  await expect(db.course.create({ data })).rejects.toMatchObject({ code: "P2002" });
});

test("ลบหมวดที่มีรายวิชาไม่ได้", async () => {
  const cat = await db.category.create({ data: { code: "1", name: "หมวด" } });
  await db.course.create({
    data: { code: "X", nameTh: "ก", theoryHours: 0, practiceHours: 0, credits: 0, categoryId: cat.id },
  });
  await expect(db.category.delete({ where: { id: cat.id } })).rejects.toMatchObject({
    code: "P2003",
  });
});

test("มี extension pg_trgm", async () => {
  const rows = await db.$queryRaw<{ n: bigint }[]>`
    SELECT count(*) AS n FROM pg_extension WHERE extname = 'pg_trgm'`;
  expect(Number(rows[0].n)).toBe(1);
});
