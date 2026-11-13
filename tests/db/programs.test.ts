import { expect, test } from "vitest";
import { db } from "@/lib/db";
import { deleteProgram, saveProgram } from "@/lib/programs";

const input = (over: Record<string, unknown> = {}) => ({
  code: "31901",
  level: "PVS",
  name: "เทคโนโลยีสารสนเทศ",
  typeName: "อุตสาหกรรมดิจิทัลและเทคโนโลยีสารสนเทศ",
  sortOrder: "0",
  ...over,
});

test("สร้างและแก้สาขา แก้แล้วรหัสไม่เปลี่ยน", async () => {
  expect(await saveProgram(null, input())).toEqual({ ok: true });
  const { id } = await db.program.findUniqueOrThrow({ where: { code: "31901" } });
  expect(await saveProgram(id, input({ code: "11111", name: "ใหม่", level: "PVC", sortOrder: "3" }))).toEqual({ ok: true });
  expect(await db.program.findUniqueOrThrow({ where: { id } })).toMatchObject({
    code: "31901",
    name: "ใหม่",
    level: "PVC",
    sortOrder: 3,
  });
  expect(await db.program.count()).toBe(1);
});

test("แก้สาขาโดยส่งรหัสว่างมาก็ได้ เพราะรหัสไม่ถูกแก้", async () => {
  await saveProgram(null, input());
  const { id } = await db.program.findUniqueOrThrow({ where: { code: "31901" } });
  expect(await saveProgram(id, input({ code: undefined, name: "ใหม่" }))).toEqual({ ok: true });
});

test("รหัสสาขาซ้ำ", async () => {
  await saveProgram(null, input());
  expect(await saveProgram(null, input({ name: "อื่น" }))).toEqual({
    ok: false,
    errors: { code: "รหัสสาขานี้มีอยู่แล้ว" },
  });
});

test("ข้อมูลไม่ผ่านการตรวจ → ข้อผิดพลาดรายช่อง", async () =>
  expect(await saveProgram(null, input({ code: "3190" }))).toEqual({
    ok: false,
    errors: { code: "รหัสสาขาต้องเป็นตัวเลข 5 หลัก" },
  }));

test("แก้/ลบสาขาที่ไม่มีแล้ว → errors._", async () => {
  const gone = { ok: false, errors: { _: "ไม่พบข้อมูล อาจถูกลบไปแล้ว" } };
  expect(await saveProgram(424242, input())).toEqual(gone);
  expect(await deleteProgram(424242)).toEqual(gone);
});

test("ลบสาขาที่ยังมีวิชาไม่ได้", async () => {
  await saveProgram(null, input());
  const program = await db.program.findUniqueOrThrow({ where: { code: "31901" } });
  const cat = await db.category.create({ data: { code: "1", name: "หมวด", programId: program.id } });
  for (const code of ["31900-0001", "31900-0002"]) {
    await db.course.create({
      data: {
        code,
        nameTh: "ก",
        theoryHours: 0,
        practiceHours: 0,
        credits: 0,
        placements: { create: { programId: program.id, categoryId: cat.id } },
      },
    });
  }
  expect(await deleteProgram(program.id)).toEqual({ ok: false, errors: { _: "ลบไม่ได้: ยังมี 2 วิชาในสาขานี้" } });
  expect(await db.program.count()).toBe(1);
});

test("ลบสาขาว่างแล้วหมวดหายตาม", async () => {
  await saveProgram(null, input());
  const program = await db.program.findUniqueOrThrow({ where: { code: "31901" } });
  const parent = await db.category.create({ data: { code: "1", name: "หมวด", programId: program.id } });
  await db.category.create({ data: { code: "1.1", name: "กลุ่ม", programId: program.id, parentId: parent.id } });
  expect(await deleteProgram(program.id)).toEqual({ ok: true });
  expect(await db.category.count({ where: { programId: program.id } })).toBe(0);
  expect(await db.program.count()).toBe(0);
});
