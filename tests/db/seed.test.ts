import bcrypt from "bcryptjs";
import { expect, test } from "vitest";
import { db } from "@/lib/db";
import { ensureAdmin, seedFromExtracted } from "@/lib/seed-data";
import type { Extracted, ExtractedCourse } from "@/scripts/pdf/parse";

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

test("สร้างหมวดเป็นต้นไม้และรายวิชา; วิชาไม่มีหมวดไปอยู่หมวด 'ยังไม่จัดหมวด' (รหัส NONE) และ needsReview", async () => {
  expect(await seedFromExtracted(db, data)).toEqual({ created: 2, updated: 0, skipped: 0 });
  const sub = await db.category.findUniqueOrThrow({ where: { code: "1.1" }, include: { parent: true } });
  expect(sub.parent?.code).toBe("1");
  expect(sub.minCredits).toBe(6);
  const orphan = await db.course.findUniqueOrThrow({ where: { code: "X-0001" }, include: { category: true } });
  expect(orphan.category).toMatchObject({ code: "NONE", name: "ยังไม่จัดหมวด" });
  expect(orphan.needsReview).toBe(true);
  expect(orphan.reviewNote).toBe("ยังไม่ได้จัดหมวดวิชา");
});

test("เหตุผลที่ต้องตรวจสอบถูกเก็บใน reviewNote", async () => {
  const flagged = { ...course("30000-1102", "1.1"), needsReview: true, reviewReasons: ["เหตุผล ก", "เหตุผล ข"] };
  await seedFromExtracted(db, { ...data, courses: [flagged] });
  expect(await db.course.findUniqueOrThrow({ where: { code: "30000-1102" } })).toMatchObject({
    needsReview: true,
    reviewNote: "เหตุผล ก; เหตุผล ข",
  });
});

test("รันซ้ำไม่เพิ่มแถว", async () => {
  await seedFromExtracted(db, data);
  expect(await seedFromExtracted(db, data)).toEqual({ created: 0, updated: 2, skipped: 0 });
  expect(await db.course.count()).toBe(2);
  expect(await db.category.count()).toBe(3);
});

test("ไม่ทับวิชาที่แก้ผ่านเว็บ เว้นแต่ force", async () => {
  await seedFromExtracted(db, data);
  await db.course.update({ where: { code: "30000-1101" }, data: { nameTh: "แก้แล้ว", editedAt: new Date() } });
  expect(await seedFromExtracted(db, data)).toEqual({ created: 0, updated: 1, skipped: 1 });
  expect((await db.course.findUniqueOrThrow({ where: { code: "30000-1101" } })).nameTh).toBe("แก้แล้ว");
  await seedFromExtracted(db, data, { force: true });
  const forced = await db.course.findUniqueOrThrow({ where: { code: "30000-1101" } });
  expect(forced.nameTh).toBe("วิชา 30000-1101");
  expect(forced.editedAt).toBeNull();
});

test("ไม่ทับหมวดที่แก้ผ่านเว็บ เว้นแต่ force", async () => {
  await seedFromExtracted(db, data);
  const top = await db.category.findUniqueOrThrow({ where: { code: "1" } });
  await db.category.update({
    where: { code: "1.1" },
    data: { name: "กลุ่มที่เปลี่ยนชื่อ", minCredits: 9, sortOrder: 7, parentId: null },
  });
  await seedFromExtracted(db, data);
  expect(await db.category.findUniqueOrThrow({ where: { code: "1.1" } })).toMatchObject({
    name: "กลุ่มที่เปลี่ยนชื่อ",
    minCredits: 9,
    sortOrder: 7,
    parentId: null,
  });
  await seedFromExtracted(db, data, { force: true });
  expect(await db.category.findUniqueOrThrow({ where: { code: "1.1" } })).toMatchObject({
    name: "กลุ่ม",
    minCredits: 6,
    parentId: top.id,
  });
});

test("ensureAdmin สร้าง ADMIN ครั้งเดียวและไม่เปลี่ยนรหัสผ่านของบัญชีที่มีอยู่", async () => {
  await ensureAdmin(db, " Admin@X.th ", "secret-1");
  await ensureAdmin(db, "admin@x.th", "secret-2");
  const users = await db.user.findMany();
  expect(users).toHaveLength(1);
  expect(users[0]).toMatchObject({ email: "admin@x.th", role: "ADMIN", active: true });
  expect(await bcrypt.compare("secret-1", users[0].passwordHash)).toBe(true);
});
