import bcrypt from "bcryptjs";
import { expect, test } from "vitest";
import { db } from "@/lib/db";
import type { ProgramEntry } from "@/lib/program-registry";
import { ensureAdmin, seedFromExtracted } from "@/lib/seed-data";
import type { Extracted, ExtractedCourse } from "@/scripts/pdf/parse";

const pvs: ProgramEntry = {
  code: "31901",
  level: "PVS",
  name: "เทคโนโลยีสารสนเทศ",
  typeName: "อุตสาหกรรมดิจิทัลและเทคโนโลยีสารสนเทศ",
  pdf: "31901v7_18_10_68.pdf",
  pages: [37, 106],
};

const course = (code: string, categoryCode: string | null): ExtractedCourse => ({
  code,
  nameTh: `วิชา ${code}`,
  nameEn: "Course",
  theoryHours: 1,
  practiceHours: 2,
  credits: 2,
  categoryCode,
  standardRef: "-",
  learningOutcome: "ก",
  objectives: "ข",
  competencies: "ค",
  description: "ง",
  sourcePage: 61,
  needsReview: false,
  reviewReasons: [],
});

const data: Extracted = {
  categories: [
    { code: "1", name: "หมวด", minCredits: 15, parentCode: null, sortOrder: 0 },
    { code: "1.1", name: "กลุ่ม", minCredits: 6, parentCode: "1", sortOrder: 1 },
  ],
  courses: [course("30000-1101", "1.1"), course("X-0001", null)],
};

const category = async (code: string) => {
  const program = await db.program.findUniqueOrThrow({ where: { code: pvs.code } });
  return db.category.findUniqueOrThrow({
    where: { programId_code: { programId: program.id, code } },
    include: { parent: true },
  });
};

const placement = (code: string) =>
  db.programCourse.findFirstOrThrow({ where: { course: { code } }, include: { category: true, program: true } });

test("สร้างสาขา หมวดเป็นต้นไม้ และรายวิชา; วิชาไม่มีหมวดไปอยู่หมวด 'ยังไม่จัดหมวด' (รหัส NONE) และ needsReview", async () => {
  expect(await seedFromExtracted(db, pvs, data)).toEqual({ created: 2, updated: 0, skipped: 0 });
  expect(await db.program.findMany()).toMatchObject([
    { code: "31901", level: "PVS", name: "เทคโนโลยีสารสนเทศ", typeName: "อุตสาหกรรมดิจิทัลและเทคโนโลยีสารสนเทศ" },
  ]);
  const sub = await category("1.1");
  expect(sub.parent?.code).toBe("1");
  expect(sub.minCredits).toBe(6);
  expect(await placement("30000-1101")).toMatchObject({ sourcePage: 61, category: { code: "1.1" }, program: { code: "31901" } });
  expect(await placement("X-0001")).toMatchObject({ category: { code: "NONE", name: "ยังไม่จัดหมวด", programId: sub.programId } });
  const orphan = await db.course.findUniqueOrThrow({ where: { code: "X-0001" } });
  expect(orphan).toMatchObject({ needsReview: true, reviewNote: "ยังไม่ได้จัดหมวดวิชา", sourceProgramCode: "31901" });
});

test("เหตุผลที่ต้องตรวจสอบถูกเก็บใน reviewNote", async () => {
  const flagged = { ...course("30000-1102", "1.1"), needsReview: true, reviewReasons: ["เหตุผล ก", "เหตุผล ข"] };
  await seedFromExtracted(db, pvs, { ...data, courses: [flagged] });
  expect(await db.course.findUniqueOrThrow({ where: { code: "30000-1102" } })).toMatchObject({
    needsReview: true,
    reviewNote: "เหตุผล ก; เหตุผล ข",
  });
});

test("รันซ้ำไม่เพิ่มแถว", async () => {
  await seedFromExtracted(db, pvs, data);
  expect(await seedFromExtracted(db, pvs, data)).toEqual({ created: 0, updated: 2, skipped: 0 });
  expect(await db.program.count()).toBe(1);
  expect(await db.course.count()).toBe(2);
  expect(await db.category.count()).toBe(3);
  expect(await db.programCourse.count()).toBe(2);
});

test("ไม่ทับวิชาที่แก้ผ่านเว็บ เว้นแต่ force", async () => {
  await seedFromExtracted(db, pvs, data);
  await db.course.update({ where: { code: "30000-1101" }, data: { nameTh: "แก้แล้ว", editedAt: new Date() } });
  expect(await seedFromExtracted(db, pvs, data)).toEqual({ created: 0, updated: 1, skipped: 1 });
  expect((await db.course.findUniqueOrThrow({ where: { code: "30000-1101" } })).nameTh).toBe("แก้แล้ว");
  await seedFromExtracted(db, pvs, data, { force: true });
  const forced = await db.course.findUniqueOrThrow({ where: { code: "30000-1101" } });
  expect(forced.nameTh).toBe("วิชา 30000-1101");
  expect(forced.editedAt).toBeNull();
});

test("ไม่ทับหมวดที่แก้ผ่านเว็บ เว้นแต่ force", async () => {
  await seedFromExtracted(db, pvs, data);
  const top = await category("1");
  await db.category.update({
    where: { id: (await category("1.1")).id },
    data: { name: "กลุ่มที่เปลี่ยนชื่อ", minCredits: 9, sortOrder: 7, parentId: null },
  });
  await seedFromExtracted(db, pvs, data);
  expect(await category("1.1")).toMatchObject({ name: "กลุ่มที่เปลี่ยนชื่อ", minCredits: 9, sortOrder: 7, parentId: null });
  await seedFromExtracted(db, pvs, data, { force: true });
  expect(await category("1.1")).toMatchObject({ name: "กลุ่ม", minCredits: 6, parentId: top.id });
});

test("ไม่ทับตำแหน่งที่ย้ายผ่านเว็บ เว้นแต่ force", async () => {
  await seedFromExtracted(db, pvs, data);
  const top = await category("1");
  const moved = await placement("30000-1101");
  await db.programCourse.update({
    where: { programId_courseId: { programId: moved.programId, courseId: moved.courseId } },
    data: { categoryId: top.id },
  });
  await seedFromExtracted(db, pvs, data);
  expect((await placement("30000-1101")).category.code).toBe("1");
  await seedFromExtracted(db, pvs, data, { force: true });
  expect((await placement("30000-1101")).category.code).toBe("1.1");
});

test("ไม่ทับสาขาที่แก้ผ่านเว็บ เว้นแต่ force", async () => {
  await seedFromExtracted(db, pvs, data);
  await db.program.update({ where: { code: "31901" }, data: { name: "ชื่อใหม่" } });
  await seedFromExtracted(db, pvs, data);
  expect((await db.program.findUniqueOrThrow({ where: { code: "31901" } })).name).toBe("ชื่อใหม่");
  await seedFromExtracted(db, pvs, data, { force: true });
  expect((await db.program.findUniqueOrThrow({ where: { code: "31901" } })).name).toBe("เทคโนโลยีสารสนเทศ");
});

test("ensureAdmin สร้าง ADMIN ครั้งเดียวและไม่เปลี่ยนรหัสผ่านของบัญชีที่มีอยู่", async () => {
  await ensureAdmin(db, " Admin@X.th ", "secret-1");
  await ensureAdmin(db, "admin@x.th", "secret-2");
  const users = await db.user.findMany();
  expect(users).toHaveLength(1);
  expect(users[0]).toMatchObject({ email: "admin@x.th", role: "ADMIN", active: true });
  expect(await bcrypt.compare("secret-1", users[0].passwordHash)).toBe(true);
});
