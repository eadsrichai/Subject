import { beforeEach, expect, test } from "vitest";
import {
  allMatchingCourses,
  getCourseByCode,
  getStats,
  listCategories,
  listCreditValues,
  searchCourses,
  type CourseFilter,
} from "@/lib/courses";
import { db } from "@/lib/db";

let program: { id: number };
let cat1: { id: number };
let cat2: { id: number };

const f = (over: Partial<CourseFilter>): CourseFilter => ({
  q: "",
  programId: program.id,
  categoryId: null,
  credits: null,
  page: 1,
  ...over,
});

const PROGRAM = { code: "31901", level: "PVS", name: "เทคโนโลยีสารสนเทศ" } as const;

beforeEach(async () => {
  program = await db.program.create({ data: { ...PROGRAM, typeName: "อุตสาหกรรมดิจิทัลและเทคโนโลยีสารสนเทศ" } });
  const programId = program.id;
  cat1 = await db.category.create({ data: { code: "1", name: "หมวดหนึ่ง", minCredits: 15, sortOrder: 0, programId } });
  const cat11 = await db.category.create({
    data: { code: "1.1", name: "กลุ่มหนึ่งจุดหนึ่ง", minCredits: 6, sortOrder: 1, parentId: cat1.id, programId },
  });
  cat2 = await db.category.create({ data: { code: "2", name: "หมวดสอง", sortOrder: 2, programId } });
  const placedIn = (categoryId: number) => ({ create: { programId, categoryId } });
  for (let i = 1; i <= 25; i++) {
    await db.course.create({
      data: {
        code: `30000-11${String(i).padStart(2, "0")}`,
        nameTh: `ภาษา ${i}`,
        nameEn: `Language ${i}`,
        theoryHours: 1,
        practiceHours: 2,
        credits: 2,
        placements: placedIn(cat11.id),
      },
    });
  }
  await db.course.create({
    data: {
      code: "31900-0001",
      nameTh: "การสร้างเว็บไซต์",
      nameEn: "Website Development",
      theoryHours: 1,
      practiceHours: 4,
      credits: 3,
      description: "ศึกษาการใช้ HTML และ CSS",
      placements: placedIn(cat2.id),
    },
  });
  await db.course.create({
    data: {
      code: "31900-0002",
      nameTh: "100% ออนไลน์_ทดสอบ",
      theoryHours: 0,
      practiceHours: 2,
      credits: 1,
      needsReview: true,
      placements: placedIn(cat2.id),
    },
  });
});

test("แบ่งหน้า 20 และเรียงตามรหัส", async () => {
  const r = await searchCourses(f({}));
  expect(r.items).toHaveLength(20);
  expect(r).toMatchObject({ total: 27, page: 1, pageCount: 2 });
  expect(r.items[0]).toEqual({
    id: expect.any(Number),
    code: "30000-1101",
    nameTh: "ภาษา 1",
    nameEn: "Language 1",
    theoryHours: 1,
    practiceHours: 2,
    credits: 2,
    categoryName: "กลุ่มหนึ่งจุดหนึ่ง",
    needsReview: false,
    programs: [PROGRAM],
  });
  expect(r.items.map((c) => c.code)).toEqual([...r.items.map((c) => c.code)].sort());
});

test("page เกินหน้าสุดท้ายถูกบีบ", async () => {
  const r = await searchCourses(f({ page: 99 }));
  expect(r.page).toBe(2);
  expect(r.items).toHaveLength(7);
});

test("ผลลัพธ์ว่างยังมี pageCount 1", async () =>
  expect(await searchCourses(f({ q: "ไม่มีแน่นอน" }))).toMatchObject({ total: 0, page: 1, pageCount: 1, items: [] }));

test.each([
  ["31900-0001", 1],
  ["เว็บไซต์", 1],
  ["website", 1],
  ["html", 1],
  ["ไม่มีแน่นอน", 0],
])("ค้น %s พบ %i", async (q, n) => expect((await searchCourses(f({ q }))).total).toBe(n));

test("% _ และ \\ เป็นตัวอักษรธรรมดา", async () => {
  expect((await searchCourses(f({ q: "%" }))).total).toBe(1);
  expect((await searchCourses(f({ q: "_" }))).total).toBe(1);
  expect((await searchCourses(f({ q: "\\" }))).total).toBe(0);
});

test("กรองหมวดรวมหมวดย่อย", async () =>
  expect((await searchCourses(f({ categoryId: cat1.id }))).total).toBe(25));

test("หมวดที่ไม่มีจริง (เช่น ลิงก์เก่าไปหมวดที่ถูกลบ) ถูกเพิกเฉย ไม่ล้ม", async () => {
  expect((await searchCourses(f({ categoryId: 999999 }))).total).toBe(27);
  expect(await allMatchingCourses(f({ categoryId: 999999 }))).toHaveLength(27);
});

test("กรองหน่วยกิตร่วมกับคำค้น", async () => {
  expect((await searchCourses(f({ q: "เว็บ", credits: 3 }))).total).toBe(1);
  expect((await searchCourses(f({ q: "เว็บ", credits: 2 }))).total).toBe(0);
});

test("allMatchingCourses ไม่แบ่งหน้า", async () => {
  expect(await allMatchingCourses(f({}))).toHaveLength(27);
  expect(await allMatchingCourses(f({ categoryId: cat2.id, page: 5 }))).toHaveLength(2);
});

test("getCourseByCode: ตรงตัว, trim, ไม่พบ → null, มีเส้นทางหมวดของแต่ละสาขา", async () => {
  const c = await getCourseByCode(" 30000-1101 ");
  expect(c?.nameTh).toBe("ภาษา 1");
  expect(c?.placements).toEqual([
    {
      program: PROGRAM,
      path: [
        { code: "1", name: "หมวดหนึ่ง" },
        { code: "1.1", name: "กลุ่มหนึ่งจุดหนึ่ง" },
      ],
    },
  ]);
  expect(await getCourseByCode("../etc")).toBeNull();
  expect(await getCourseByCode("")).toBeNull();
});

test("getCourseByCode: ตำแหน่งหลายสาขาเรียงตามลำดับสาขา", async () => {
  const pvc = await db.program.create({ data: { code: "21901", level: "PVC", name: "ปวช.", typeName: "อื่น", sortOrder: -1 } });
  const pvcCat = await db.category.create({ data: { code: "2", name: "หมวดของ ปวช.", programId: pvc.id } });
  const course = await db.course.findUniqueOrThrow({ where: { code: "31900-0001" } });
  await db.programCourse.create({ data: { programId: pvc.id, courseId: course.id, categoryId: pvcCat.id } });
  expect((await getCourseByCode("31900-0001"))?.placements).toEqual([
    { program: { code: "21901", level: "PVC", name: "ปวช." }, path: [{ code: "2", name: "หมวดของ ปวช." }] },
    { program: PROGRAM, path: [{ code: "2", name: "หมวดสอง" }] },
  ]);
});

test("listCategories เรียงแบบต้นไม้และนับรวมหมวดย่อย", async () =>
  expect((await listCategories(program.id)).map((c) => [c.code, c.depth, c.courseCount])).toEqual([
    ["1", 0, 25],
    ["1.1", 1, 25],
    ["2", 0, 2],
  ]));

test("getStats", async () => {
  const s = await getStats(program.id);
  expect(s.totalCourses).toBe(27);
  expect(s.byCategory).toEqual([
    { code: "1", name: "หมวดหนึ่ง", depth: 0, courses: 25, credits: 50, minCredits: 15 },
    { code: "1.1", name: "กลุ่มหนึ่งจุดหนึ่ง", depth: 1, courses: 25, credits: 50, minCredits: 6 },
    { code: "2", name: "หมวดสอง", depth: 0, courses: 2, credits: 4, minCredits: null },
  ]);
  expect(s.byCredits).toEqual([
    { credits: 1, courses: 1 },
    { credits: 2, courses: 25 },
    { credits: 3, courses: 1 },
  ]);
  expect(s.hours).toEqual({ theory: 26, practice: 56 });
});

test("หมวดของสาขาอื่นถูกเพิกเฉย", async () => {
  const other = await db.program.create({ data: { code: "21901", level: "PVC", name: "อื่น", typeName: "อื่น" } });
  const foreign = await db.category.create({ data: { code: "1", name: "หมวดสาขาอื่น", programId: other.id } });
  expect((await searchCourses(f({ categoryId: foreign.id }))).total).toBe(27);
});

test("ค้นข้ามสาขา (programId null) ได้ categoryName null และรายชื่อสาขา", async () => {
  const r = await searchCourses(f({ programId: null, q: "30000-1101" }));
  expect(r.items[0]).toMatchObject({ categoryName: null, programs: [{ code: "31901", level: "PVS" }] });
});

test("วิชาที่ไม่อยู่ในสาขาไม่นับในหน้าสาขา แต่พบในการค้นข้ามสาขา", async () => {
  await db.course.create({ data: { code: "39999-0001", nameTh: "ไม่มีสาขา", theoryHours: 9, practiceHours: 9, credits: 9 } });
  expect((await searchCourses(f({}))).total).toBe(27);
  expect((await getStats(program.id)).totalCourses).toBe(27);
  expect(await listCreditValues(program.id)).toEqual([1, 2, 3]);
  expect(await listCreditValues(null)).toEqual([1, 2, 3, 9]);
  const r = await searchCourses(f({ programId: null, q: "39999" }));
  expect(r.items).toMatchObject([{ code: "39999-0001", categoryName: null, programs: [] }]);
});
