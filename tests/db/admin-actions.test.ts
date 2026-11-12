import { beforeEach, expect, test } from "vitest";
import { deleteCategory, deleteCourse, saveCategory, saveCourse } from "@/lib/course-admin";
import { db } from "@/lib/db";

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

beforeEach(async () => {
  cat = await db.category.create({ data: { code: "2", name: "หมวดสอง" } });
  sub = await db.category.create({ data: { code: "2.1", name: "กลุ่ม", parentId: cat.id } });
});

test("สร้างรายวิชา: บันทึกค่าและตั้ง editedAt", async () => {
  expect(await saveCourse(null, input())).toEqual({ ok: true });
  const c = await db.course.findUniqueOrThrow({ where: { code: "31900-0001" } });
  expect(c).toMatchObject({ nameTh: "การสร้างเว็บไซต์", theoryHours: 1, practiceHours: 4, credits: 3, categoryId: cat.id, description: "ศึกษา", objectives: null });
  expect(c.editedAt).toBeInstanceOf(Date);
});

test("แก้ไข: ล้าง needsReview และ reviewNote เมื่อไม่ได้ติ๊ก, คงไว้เมื่อติ๊ก", async () => {
  const c = await db.course.create({
    data: { code: "31900-0002", nameTh: "ก", theoryHours: 0, practiceHours: 0, credits: 0, categoryId: cat.id, needsReview: true, reviewNote: "ขาดหัวข้อ" },
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
  const r = await searchCourses({ q: "จัดทำคำอธิบาย", categoryId: null, credits: null, page: 1 });
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
  expect(await saveCategory(null, { code: "3", name: "หมวดสาม", minCredits: "5", parentId: "", sortOrder: "9" })).toEqual({ ok: true });
  const c = await db.category.findUniqueOrThrow({ where: { code: "3" } });
  expect(c).toMatchObject({ name: "หมวดสาม", minCredits: 5, parentId: null, sortOrder: 9 });
  expect(await saveCategory(c.id, { code: "3", name: "เปลี่ยนชื่อ", minCredits: "", parentId: String(cat.id), sortOrder: "9" })).toEqual({ ok: true });
  expect(await db.category.findUniqueOrThrow({ where: { id: c.id } })).toMatchObject({ name: "เปลี่ยนชื่อ", minCredits: null, parentId: cat.id });
});

test("รหัสหมวดซ้ำ → errors.code", async () =>
  expect(await saveCategory(null, { code: "2.1", name: "ซ้ำ" })).toEqual({ ok: false, errors: { code: "รหัสหมวดนี้มีอยู่แล้ว" } }));

test("ตั้งหมวดแม่เป็นตัวเอง ลูกหลานของตัวเอง หรือหมวดที่ไม่มีจริง → errors.parentId", async () => {
  const bad = { ok: false, errors: { parentId: "เลือกหมวดแม่ไม่ถูกต้อง" } };
  expect(await saveCategory(cat.id, { code: "2", name: "หมวดสอง", parentId: String(cat.id) })).toEqual(bad);
  expect(await saveCategory(cat.id, { code: "2", name: "หมวดสอง", parentId: String(sub.id) })).toEqual(bad);
  expect(await saveCategory(cat.id, { code: "2", name: "หมวดสอง", parentId: "999999" })).toEqual(bad);
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
