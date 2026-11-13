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

const pvc: ProgramEntry = {
  code: "21901",
  level: "PVC",
  name: "เทคโนโลยีสารสนเทศ",
  typeName: "อุตสาหกรรมดิจิทัลและเทคโนโลยีสารสนเทศ",
  pdf: "ปวช-เทคโนโลยีสารสนเทศ-21901.pdf",
  pages: [14, 81],
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

const withCourse = (fields: Partial<ExtractedCourse> & { code: string }): Extracted => ({
  ...data,
  courses: [{ ...course(fields.code, "1.1"), ...fields }],
});

const summary = (counts: Partial<Record<"created" | "updated" | "shared" | "filled" | "conflicts" | "skipped", number>>) => ({
  created: 0, updated: 0, shared: 0, filled: 0, conflicts: 0, skipped: 0, ...counts,
});

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
  expect(await seedFromExtracted(db, pvs, data)).toEqual(summary({ created: 2 }));
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
  expect(await seedFromExtracted(db, pvs, data)).toEqual(summary({ updated: 2 }));
  expect(await db.program.count()).toBe(1);
  expect(await db.course.count()).toBe(2);
  expect(await db.category.count()).toBe(3);
  expect(await db.programCourse.count()).toBe(2);
});

test("วิชาใหม่: เจ้าของคือสาขาที่นำเข้า", async () => {
  await seedFromExtracted(db, pvs, data);
  expect((await db.course.findUniqueOrThrow({ where: { code: "30000-1101" } })).sourceProgramCode).toBe("31901");
});

test("สาขาอื่นเติมได้เฉพาะช่องว่าง เนื้อหาต่างได้ธงพร้อมหมายเหตุ", async () => {
  await seedFromExtracted(db, pvs, withCourse({ code: "X-1", description: null, objectives: "ก" }));
  const r = await seedFromExtracted(db, pvc, withCourse({ code: "X-1", description: "คำอธิบาย", objectives: "ข" }));
  expect(r).toMatchObject({ created: 0, shared: 1, filled: 1, conflicts: 1 });
  expect(await db.course.findUniqueOrThrow({ where: { code: "X-1" } })).toMatchObject({
    description: "คำอธิบาย",
    objectives: "ก",
    sourceProgramCode: "31901",
    needsReview: true,
    reviewNote: expect.stringContaining("เนื้อหาต่างจากหลักสูตร 21901: objectives"),
  });
});

test("วิชาที่สร้างผ่านเว็บ (เจ้าของ null) ถือเป็นสาขาอื่น ไม่ถูกทับแม้ใช้ force", async () => {
  await seedFromExtracted(db, pvs, withCourse({ code: "X-1", nameTh: "ชื่อเดิม" }));
  await db.course.update({ where: { code: "X-1" }, data: { sourceProgramCode: null, editedAt: new Date() } });
  const r = await seedFromExtracted(db, pvs, withCourse({ code: "X-1", nameTh: "ชื่ออื่น" }), { force: true });
  expect(r).toEqual(summary({ shared: 1, conflicts: 1 }));
  expect(await db.course.findUniqueOrThrow({ where: { code: "X-1" } })).toMatchObject({
    nameTh: "ชื่อเดิม",
    sourceProgramCode: null,
    reviewNote: "เนื้อหาต่างจากหลักสูตร 31901: nameTh",
  });
});

test("ช่องว่างต่างกันไม่ถือว่าเนื้อหาต่าง", async () => {
  await seedFromExtracted(db, pvs, withCourse({ code: "X-1", objectives: "ก  ข\n" }));
  const r = await seedFromExtracted(db, pvc, withCourse({ code: "X-1", objectives: " ก ข" }));
  expect(r).toEqual(summary({ shared: 1 }));
  expect(await db.course.findUniqueOrThrow({ where: { code: "X-1" } })).toMatchObject({
    objectives: "ก  ข\n",
    needsReview: false,
    reviewNote: null,
  });
});

test("seed ซ้ำสองรอบไม่ต่อหมายเหตุซ้ำ", async () => {
  const owner = withCourse({ code: "X-1", objectives: "ก", reviewReasons: ["เหตุผลจากเล่ม"] });
  const other = withCourse({ code: "X-1", objectives: "ข", competencies: "อื่น" });
  await seedFromExtracted(db, pvs, owner);
  await seedFromExtracted(db, pvc, other);
  const placements = await db.programCourse.count();
  await seedFromExtracted(db, pvs, owner);
  expect(await seedFromExtracted(db, pvc, other)).toEqual(summary({ shared: 1, conflicts: 1 }));
  const row = await db.course.findUniqueOrThrow({ where: { code: "X-1" } });
  expect(row.reviewNote).toBe("เหตุผลจากเล่ม; เนื้อหาต่างจากหลักสูตร 21901: objectives, competencies");
  expect(row.reviewNote!.split("เนื้อหาต่างจากหลักสูตร 21901")).toHaveLength(2);
  expect(await db.programCourse.count()).toBe(placements);
});

test("หมายเหตุของสาขาเดิมถูกแทนด้วยรายการช่องล่าสุด", async () => {
  await seedFromExtracted(db, pvs, withCourse({ code: "X-1", objectives: "ก", competencies: "ค" }));
  await seedFromExtracted(db, pvc, withCourse({ code: "X-1", objectives: "ข", competencies: "ค" }));
  await seedFromExtracted(db, pvc, withCourse({ code: "X-1", objectives: "ข", competencies: "ง" }));
  expect((await db.course.findUniqueOrThrow({ where: { code: "X-1" } })).reviewNote).toBe(
    "เนื้อหาต่างจากหลักสูตร 21901: objectives, competencies",
  );
});

test("เจ้าของอัปเดตเนื้อหาได้ แต่ไม่ทับวิชาที่แก้ผ่านเว็บ เว้นแต่ force", async () => {
  await seedFromExtracted(db, pvs, data);
  await db.course.update({ where: { code: "X-0001" }, data: { nameTh: "ชื่อเก่า" } });
  await db.course.update({ where: { code: "30000-1101" }, data: { nameTh: "แก้แล้ว", editedAt: new Date() } });
  expect(await seedFromExtracted(db, pvs, data)).toEqual(summary({ updated: 1, skipped: 1 }));
  expect((await db.course.findUniqueOrThrow({ where: { code: "X-0001" } })).nameTh).toBe("วิชา X-0001");
  expect((await db.course.findUniqueOrThrow({ where: { code: "30000-1101" } })).nameTh).toBe("แก้แล้ว");
  await seedFromExtracted(db, pvs, data, { force: true });
  const forced = await db.course.findUniqueOrThrow({ where: { code: "30000-1101" } });
  expect(forced).toMatchObject({ nameTh: "วิชา 30000-1101", editedAt: null, sourceProgramCode: "31901" });
});

test("ลำดับสาขามาจากลำดับในไฟล์ทะเบียน ตั้งตอนสร้าง (หรือ force) เท่านั้น", async () => {
  await seedFromExtracted(db, pvs, data, { sortOrder: 0 });
  await seedFromExtracted(db, pvc, data, { sortOrder: 1 });
  const order = async () => (await db.program.findMany({ orderBy: { code: "asc" } })).map((p) => [p.code, p.sortOrder]);
  expect(await order()).toEqual([["21901", 1], ["31901", 0]]);
  await db.program.update({ where: { code: "21901" }, data: { sortOrder: 5 } });
  await seedFromExtracted(db, pvc, data, { sortOrder: 1 });
  expect(await order()).toEqual([["21901", 5], ["31901", 0]]);
  await seedFromExtracted(db, pvc, data, { sortOrder: 1, force: true });
  expect(await order()).toEqual([["21901", 1], ["31901", 0]]);
});

test("วิชาเจ้าของ null ที่ไม่เคยแก้ผ่านเว็บ (seed ก่อน migration) สาขาที่นำเข้ารับเป็นเจ้าของ", async () => {
  await seedFromExtracted(db, pvs, withCourse({ code: "X-1", nameTh: "ชื่อเดิม" }));
  await db.course.update({ where: { code: "X-1" }, data: { sourceProgramCode: null } });
  const r = await seedFromExtracted(db, pvs, withCourse({ code: "X-1", nameTh: "ชื่อใหม่" }));
  expect(r).toEqual(summary({ updated: 1 }));
  expect(await db.course.findUniqueOrThrow({ where: { code: "X-1" } })).toMatchObject({
    nameTh: "ชื่อใหม่",
    sourceProgramCode: "31901",
    needsReview: false,
  });
});

test("วิชาเดียวอยู่สองสาขา", async () => {
  await seedFromExtracted(db, pvs, data);
  expect(await seedFromExtracted(db, pvc, data)).toEqual(summary({ shared: 2 }));
  expect(await db.programCourse.count({ where: { course: { code: "30000-1101" } } })).toBe(2);
  expect((await db.course.findUniqueOrThrow({ where: { code: "30000-1101" } })).sourceProgramCode).toBe("31901");
  expect(await db.program.count()).toBe(2);
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

test("ไม่ทับตำแหน่งที่ย้ายผ่านเว็บ และไม่ทับชื่อสาขาที่แก้ เว้นแต่ force", async () => {
  await seedFromExtracted(db, pvs, data);
  const top = await category("1");
  const moved = await placement("30000-1101");
  await db.programCourse.update({
    where: { programId_courseId: { programId: moved.programId, courseId: moved.courseId } },
    data: { categoryId: top.id },
  });
  await db.program.update({ where: { code: "31901" }, data: { name: "ชื่อใหม่" } });
  await seedFromExtracted(db, pvs, data);
  expect((await placement("30000-1101")).category.code).toBe("1");
  expect((await db.program.findUniqueOrThrow({ where: { code: "31901" } })).name).toBe("ชื่อใหม่");
  await seedFromExtracted(db, pvs, data, { force: true });
  expect((await placement("30000-1101")).category.code).toBe("1.1");
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
