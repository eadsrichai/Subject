import { beforeEach, expect, test } from "vitest";
import { deleteCategory, deleteCourse, saveCategory, saveCourse } from "@/lib/course-admin";
import { db } from "@/lib/db";

let program: { id: number };
let cat: { id: number };
let sub: { id: number };

const input = (over: Record<string, unknown> = {}) => ({
  code: "31900-0001",
  nameTh: "การสร้างเว็บไซต์",
  nameEn: "Website Development",
  theoryHours: "1",
  practiceHours: "4",
  credits: "3",
  categoryId: String(cat.id),
  description: "ศึกษา",
  ...over,
});

const catInput = (over: Record<string, unknown> = {}) => ({ programId: String(program.id), ...over });

const placementsOf = (code: string) =>
  db.programCourse.findMany({ where: { course: { code } }, select: { programId: true, categoryId: true } });

beforeEach(async () => {
  program = await db.program.create({
    data: { code: "31901", level: "PVS", name: "เทคโนโลยีสารสนเทศ", typeName: "อุตสาหกรรมดิจิทัลและเทคโนโลยีสารสนเทศ" },
  });
  cat = await db.category.create({ data: { code: "2", name: "หมวดสอง", programId: program.id } });
  sub = await db.category.create({ data: { code: "2.1", name: "กลุ่ม", parentId: cat.id, programId: program.id } });
});

test("สร้างรายวิชา: บันทึกค่าและตั้ง editedAt", async () => {
  expect(await saveCourse(null, input())).toEqual({ ok: true });
  const c = await db.course.findUniqueOrThrow({ where: { code: "31900-0001" } });
  expect(c).toMatchObject({ nameTh: "การสร้างเว็บไซต์", theoryHours: 1, practiceHours: 4, credits: 3, description: "ศึกษา", objectives: null, sourceProgramCode: null });
  expect(c.editedAt).toBeInstanceOf(Date);
  expect(await placementsOf("31900-0001")).toEqual([{ programId: program.id, categoryId: cat.id }]);
});

test("แก้หมวดของวิชา: แทนที่ตำแหน่งในสาขาของหมวดนั้น และไม่แตะสาขาอื่น", async () => {
  const other = await db.program.create({ data: { code: "21901", level: "PVC", name: "อื่น", typeName: "อื่น" } });
  const otherCat = await db.category.create({ data: { code: "1", name: "หมวดสาขาอื่น", programId: other.id } });
  await saveCourse(null, input());
  const c = await db.course.findUniqueOrThrow({ where: { code: "31900-0001" } });
  await db.programCourse.create({ data: { programId: other.id, courseId: c.id, categoryId: otherCat.id, sourcePage: 5 } });
  expect(await saveCourse(c.id, input({ categoryId: String(sub.id) }))).toEqual({ ok: true });
  expect(await placementsOf("31900-0001")).toEqual(
    expect.arrayContaining([
      { programId: program.id, categoryId: sub.id },
      { programId: other.id, categoryId: otherCat.id },
    ]),
  );
  expect(await db.programCourse.count()).toBe(2);
});

test("แก้ไข: ล้าง needsReview และ reviewNote เมื่อไม่ได้ติ๊ก, คงไว้เมื่อติ๊ก", async () => {
  const c = await db.course.create({
    data: {
      code: "31900-0002", nameTh: "ก", theoryHours: 0, practiceHours: 0, credits: 0, needsReview: true, reviewNote: "ขาดหัวข้อ",
      placements: { create: { programId: program.id, categoryId: cat.id } },
    },
  });
  expect(await saveCourse(c.id, input({ code: "31900-0002", needsReview: "on" }))).toEqual({ ok: true });
  expect(await db.course.findUniqueOrThrow({ where: { id: c.id } })).toMatchObject({ needsReview: true, reviewNote: "ขาดหัวข้อ", nameTh: "การสร้างเว็บไซต์" });
  expect(await saveCourse(c.id, input({ code: "31900-0002" }))).toEqual({ ok: true });
  const after = await db.course.findUniqueOrThrow({ where: { id: c.id } });
  expect(after).toMatchObject({ needsReview: false, reviewNote: null });
  expect(after.editedAt).toBeInstanceOf(Date);
});

test("ชื่อที่วางจาก PDF (สระอำแยกตัว) ค้นหาเจอด้วยคำที่พิมพ์ปกติ", async () => {
  const { searchCourses } = await import("@/lib/courses");
  expect(await saveCourse(null, input({ nameTh: "การจัดทําคําอธิบาย" }))).toEqual({ ok: true });
  const r = await searchCourses({ q: "จัดทำคำอธิบาย", programId: program.id, categoryId: null, credits: null, page: 1 });
  expect(r.items.map((c) => c.nameTh)).toEqual(["การจัดทำคำอธิบาย"]);
});

test("ข้อมูลไม่ผ่านการตรวจ → คืนข้อผิดพลาดรายช่อง และไม่บันทึก", async () => {
  expect(await saveCourse(null, input({ nameTh: " " }))).toEqual({ ok: false, errors: { nameTh: "กรุณากรอกชื่อวิชา" } });
  expect(await db.course.count()).toBe(0);
});

test("รหัสซ้ำ → errors.code", async () => {
  await saveCourse(null, input());
  expect(await saveCourse(null, input({ nameTh: "อีกวิชา" }))).toEqual({ ok: false, errors: { code: "รหัสวิชานี้มีอยู่แล้ว" } });
  expect(await db.course.count()).toBe(1);
});

test("แก้วิชาโดยคงรหัสเดิมไม่ถือว่าซ้ำ แต่เปลี่ยนไปชนรหัสวิชาอื่นถือว่าซ้ำ", async () => {
  await saveCourse(null, input());
  await saveCourse(null, input({ code: "31900-0002" }));
  const first = await db.course.findUniqueOrThrow({ where: { code: "31900-0001" } });
  expect(await saveCourse(first.id, input({ nameTh: "ชื่อใหม่" }))).toEqual({ ok: true });
  expect(await saveCourse(first.id, input({ code: "31900-0002" }))).toEqual({ ok: false, errors: { code: "รหัสวิชานี้มีอยู่แล้ว" } });
});

test("categoryId ที่ไม่มีจริง → errors.categoryId", async () =>
  expect(await saveCourse(null, input({ categoryId: "999999" }))).toEqual({ ok: false, errors: { categoryId: "ไม่พบหมวดวิชาที่เลือก" } }));

test("แก้/ลบรายวิชาที่ไม่มีแล้ว → errors._", async () => {
  const gone = { ok: false, errors: { _: "ไม่พบข้อมูล อาจถูกลบไปแล้ว" } };
  expect(await saveCourse(424242, input())).toEqual(gone);
  expect(await deleteCourse(424242)).toEqual(gone);
});

test("ลบรายวิชา", async () => {
  await saveCourse(null, input());
  const c = await db.course.findUniqueOrThrow({ where: { code: "31900-0001" } });
  expect(await deleteCourse(c.id)).toEqual({ ok: true });
  expect(await db.course.count()).toBe(0);
});

test("สร้างและแก้ไขหมวด", async () => {
  expect(await saveCategory(null, catInput({ code: "3", name: "หมวดสาม", minCredits: "5", parentId: "", sortOrder: "9" }))).toEqual({ ok: true });
  const c = await db.category.findUniqueOrThrow({ where: { programId_code: { programId: program.id, code: "3" } } });
  expect(c).toMatchObject({ name: "หมวดสาม", minCredits: 5, parentId: null, sortOrder: 9 });
  expect(await saveCategory(c.id, catInput({ code: "3", name: "เปลี่ยนชื่อ", minCredits: "", parentId: String(cat.id), sortOrder: "9" }))).toEqual({ ok: true });
  expect(await db.category.findUniqueOrThrow({ where: { id: c.id } })).toMatchObject({ name: "เปลี่ยนชื่อ", minCredits: null, parentId: cat.id });
});

test("รหัสหมวดซ้ำ → errors.code", async () =>
  expect(await saveCategory(null, catInput({ code: "2.1", name: "ซ้ำ" }))).toEqual({ ok: false, errors: { code: "รหัสหมวดนี้มีอยู่แล้ว" } }));

test("รหัสหมวดซ้ำได้ข้ามสาขา แต่ซ้ำในสาขาเดียวไม่ได้", async () => {
  const other = await db.program.create({ data: { code: "21901", level: "PVC", name: "อื่น", typeName: "อื่น" } });
  expect(await saveCategory(null, { programId: String(other.id), code: "2", name: "หมวดสองของสาขาอื่น" })).toEqual({ ok: true });
  expect(await saveCategory(null, { programId: String(other.id), code: "2", name: "ซ้ำ" })).toEqual({
    ok: false,
    errors: { code: "รหัสหมวดนี้มีอยู่แล้ว" },
  });
  expect(await db.category.count({ where: { code: "2" } })).toBe(2);
});

test("หมวดแม่ต้องอยู่สาขาเดียวกัน", async () => {
  const other = await db.program.create({ data: { code: "21901", level: "PVC", name: "อื่น", typeName: "อื่น" } });
  const bad = { ok: false, errors: { parentId: "เลือกหมวดแม่ไม่ถูกต้อง" } };
  expect(await saveCategory(null, { programId: String(other.id), code: "1", name: "ก", parentId: String(cat.id) })).toEqual(bad);
  const foreign = await db.category.create({ data: { code: "1", name: "หมวดสาขาอื่น", programId: other.id } });
  expect(await saveCategory(sub.id, catInput({ code: "2.1", name: "กลุ่ม", parentId: String(foreign.id) }))).toEqual(bad);
  expect(await db.category.count({ where: { programId: other.id } })).toBe(1);
});

test("แก้หมวดไม่ย้ายหมวดไปสาขาอื่น", async () => {
  const other = await db.program.create({ data: { code: "21901", level: "PVC", name: "อื่น", typeName: "อื่น" } });
  expect(await saveCategory(cat.id, { programId: String(other.id), code: "2", name: "หมวดสอง" })).toEqual({ ok: true });
  expect((await db.category.findUniqueOrThrow({ where: { id: cat.id } })).programId).toBe(program.id);
});

test("สาขาที่ไม่มีจริง → errors.programId", async () =>
  expect(await saveCategory(null, { programId: "999999", code: "9", name: "ก" })).toEqual({
    ok: false,
    errors: { programId: "ไม่พบสาขาที่เลือก" },
  }));

test("ตั้งหมวดแม่เป็นตัวเอง ลูกหลานของตัวเอง หรือหมวดที่ไม่มีจริง → errors.parentId", async () => {
  const bad = { ok: false, errors: { parentId: "เลือกหมวดแม่ไม่ถูกต้อง" } };
  expect(await saveCategory(cat.id, catInput({ code: "2", name: "หมวดสอง", parentId: String(cat.id) }))).toEqual(bad);
  expect(await saveCategory(cat.id, catInput({ code: "2", name: "หมวดสอง", parentId: String(sub.id) }))).toEqual(bad);
  expect(await saveCategory(cat.id, catInput({ code: "2", name: "หมวดสอง", parentId: "999999" }))).toEqual(bad);
  expect((await db.category.findUniqueOrThrow({ where: { id: cat.id } })).parentId).toBeNull();
});

test("ลบหมวดที่มีหมวดย่อยหรือรายวิชาไม่ได้ ลบหมวดว่างได้", async () => {
  const blocked = { ok: false, errors: { _: "ลบไม่ได้: ยังมีรายวิชาหรือหมวดย่อยอยู่" } };
  expect(await deleteCategory(cat.id)).toEqual(blocked);
  await saveCourse(null, input({ categoryId: String(sub.id) }));
  expect(await deleteCategory(sub.id)).toEqual(blocked);
  expect(await db.category.count()).toBe(2);

  await db.course.deleteMany();
  expect(await deleteCategory(sub.id)).toEqual({ ok: true });
  expect(await deleteCategory(sub.id)).toEqual({ ok: false, errors: { _: "ไม่พบข้อมูล อาจถูกลบไปแล้ว" } });
});
