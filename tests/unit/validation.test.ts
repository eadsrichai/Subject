import { expect, test } from "vitest";
import { categorySchema, courseSchema, fieldErrors, parsePlacements, programSchema } from "@/lib/validation";

const valid = {
  code: "31900-0001",
  nameTh: "การสร้างเว็บไซต์",
  nameEn: "Website Development",
  theoryHours: 1,
  practiceHours: 4,
  credits: 3,
  placements: [{ programId: 1, categoryId: 5 }],
};

test.each([
  ["31900-0001", true],
  [" 31900-0001 ", true],
  ["3190-0001", false],
  ["31900_0001", false],
  ["", false],
])("รหัส %s", (code, ok) => expect(courseSchema.safeParse({ ...valid, code }).success).toBe(ok));

test("ตัดช่องว่างหัวท้ายและแปลงสตริงว่างของช่องข้อความยาวเป็น null", () =>
  expect(courseSchema.parse({ ...valid, nameTh: " ก ", description: "  ", objectives: " 1. ก\n2. ข " })).toMatchObject({
    nameTh: "ก",
    description: null,
    objectives: "1. ก\n2. ข",
    standardRef: null,
    needsReview: false,
  }));

test("ข้อความที่วางจาก PDF ถูกแก้อักขระไทย: ชื่อยุบช่องว่าง ข้อความยาวคงการขึ้นบรรทัด", () =>
  expect(
    courseSchema.parse({
      ...valid,
      nameTh: "ค ำอธิบาย  กลุม",
      nameEn: "Web  Design",
      objectives: "1. ใชงาน  คําสั่ง\n2. ซอฟตแวร",
    }),
  ).toMatchObject({
    nameTh: "คำอธิบาย กลุ่ม",
    nameEn: "Web Design",
    objectives: "1. ใช้งาน คำสั่ง\n2. ซอฟต์แวร์",
  }));

test("ชื่อหมวดที่วางจาก PDF ถูกแก้อักขระไทย", () =>
  expect(categorySchema.parse({ programId: "1", code: "9", name: "กลุมใหม" }).name).toBe("กลุ่มใหม่"));

test("ค่าจากฟอร์ม (สตริง) ถูกแปลงเป็นตัวเลขและ boolean", () =>
  expect(
    courseSchema.parse({ ...valid, theoryHours: "2", practiceHours: "0", credits: "3", placements: [{ programId: "2", categoryId: "7" }], needsReview: "on" }),
  ).toMatchObject({ theoryHours: 2, practiceHours: 0, credits: 3, placements: [{ programId: 2, categoryId: 7 }], needsReview: true }));

test("ชั่วโมงติดลบ ทศนิยม เกิน 99 ว่าง หรือไม่ใช่ตัวเลข ไม่ผ่าน", () => {
  for (const v of [-1, 1.5, 100, "", "abc", null]) {
    expect(courseSchema.safeParse({ ...valid, credits: v }).success).toBe(false);
  }
});

test("ข้อความยาวเกิน 10000 ตัวอักษรไม่ผ่าน", () =>
  expect(courseSchema.safeParse({ ...valid, description: "ก".repeat(10001) }).success).toBe(false));

test("ข้อความผิดพลาดเป็นภาษาไทย แยกตามช่อง", () => {
  const r = courseSchema.safeParse({ ...valid, nameTh: "", code: "x", credits: "", placements: [{ programId: "1", categoryId: "" }] });
  expect(r.success).toBe(false);
  if (!r.success) {
    expect(fieldErrors(r.error)).toEqual({
      nameTh: "กรุณากรอกชื่อวิชา",
      code: "รหัสวิชาต้องอยู่ในรูปแบบ 00000-0000",
      credits: "ต้องเป็นจำนวนเต็ม 0–99",
      "placements.0.categoryId": "กรุณาเลือกหมวดวิชา",
    });
  }
});

test("หมวดวิชา: ค่าว่างของหน่วยกิตขั้นต่ำและหมวดแม่เป็น null", () =>
  expect(categorySchema.parse({ programId: "1", code: " 2.3 ", name: " กลุ่มใหม่ ", minCredits: "", parentId: "", sortOrder: "4" })).toEqual({
    programId: 1,
    code: "2.3",
    name: "กลุ่มใหม่",
    minCredits: null,
    parentId: null,
    sortOrder: 4,
    note: null,
  }));

test("หมวดวิชา: ต้องมีสาขา รหัส และชื่อ", () => {
  const r = categorySchema.safeParse({ code: "", name: " ", minCredits: "1000" });
  expect(r.success).toBe(false);
  if (!r.success) {
    expect(fieldErrors(r.error)).toEqual({
      programId: "ไม่พบสาขาที่เลือก",
      code: "กรุณากรอกรหัสหมวด",
      name: "กรุณากรอกชื่อหมวด",
      minCredits: "ต้องเป็นจำนวนเต็ม 0–999",
    });
  }
});

test("parsePlacements เรียงแถวตาม index จากคีย์ของฟอร์ม", () =>
  expect(
    parsePlacements({
      "placements.1.programId": "2",
      "placements.0.programId": "1",
      "placements.0.categoryId": "5",
      "placements.1.categoryId": "6",
      nameTh: "ไม่เกี่ยว",
    }),
  ).toEqual([
    { programId: "1", categoryId: "5" },
    { programId: "2", categoryId: "6" },
  ]));

test("ไม่มีแถวตำแหน่งเลยก็ผ่าน", () => {
  expect(parsePlacements({ nameTh: "ก" })).toEqual([]);
  expect(courseSchema.parse({ ...valid, placements: [] }).placements).toEqual([]);
});

test("สาขา: รหัสต้องเป็นตัวเลข 5 หลัก ชื่อและประเภทวิชาห้ามว่าง", () => {
  const ok = { code: "21901", level: "PVC", name: " เทคโนโลยีสารสนเทศ ", typeName: "อุตสาหกรรมดิจิทัล", sortOrder: "1" };
  expect(programSchema.parse(ok)).toEqual({ ...ok, name: "เทคโนโลยีสารสนเทศ", sortOrder: 1 });
  const r = programSchema.safeParse({ ...ok, code: "3190", level: "X", name: "", typeName: " " });
  expect(r.success).toBe(false);
  if (!r.success) {
    expect(fieldErrors(r.error)).toEqual({
      code: "รหัสสาขาต้องเป็นตัวเลข 5 หลัก",
      level: "กรุณาเลือกระดับ",
      name: "กรุณากรอกชื่อสาขา",
      typeName: "กรุณากรอกประเภทวิชา",
    });
  }
});
