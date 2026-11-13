import type { Extracted, ExtractedCourse } from "../../scripts/pdf/parse";

const base = (code: string, nameTh: string, nameEn: string, categoryCode: string): ExtractedCourse => ({
  code,
  nameTh,
  nameEn,
  theoryHours: 1,
  practiceHours: 2,
  credits: 2,
  categoryCode,
  standardRef: null,
  learningOutcome: null,
  objectives: null,
  competencies: null,
  description: null,
  sourcePage: null,
  needsReview: false,
  reviewReasons: [],
});

/** 45 courses in two groups: enough for three pages, one fully described, one flagged. */
export const sampleData: Extracted = {
  categories: [
    { code: "1", name: "หมวดวิชาสมรรถนะแกนกลาง", minCredits: 15, parentCode: null, sortOrder: 0 },
    { code: "1.1", name: "กลุ่มสมรรถนะภาษาและการสื่อสาร", minCredits: 6, parentCode: "1", sortOrder: 1 },
    { code: "2", name: "หมวดวิชาสมรรถนะวิชาชีพ", minCredits: 60, parentCode: null, sortOrder: 2 },
    { code: "2.1", name: "กลุ่มสมรรถนะวิชาชีพพื้นฐาน", minCredits: 15, parentCode: "2", sortOrder: 3 },
  ],
  courses: [
    ...Array.from({ length: 30 }, (_, i) =>
      base(`30000-11${String(i + 1).padStart(2, "0")}`, `ภาษาเพื่อการสื่อสาร ${i + 1}`, `Communication ${i + 1}`, "1.1"),
    ),
    {
      ...base("31900-0001", "การสร้างเว็บไซต์", "Website Development", "2.1"),
      theoryHours: 1,
      practiceHours: 4,
      credits: 3,
      standardRef: "-",
      learningOutcome: "สร้างเว็บไซต์ด้วยโปรแกรมภาษาหรือโปรแกรมสำเร็จรูป",
      objectives: "1. รู้และเข้าใจกระบวนการพัฒนาเว็บไซต์\n2. มีทักษะในการสร้างเว็บไซต์",
      competencies: "1. สร้างเว็บไซต์ตามหลักการ",
      description: "ศึกษาและปฏิบัติเกี่ยวกับหลักการสร้างเว็บไซต์ด้วย HTML",
      sourcePage: 49,
    },
    {
      ...base("31900-0002", "การเขียนโปรแกรมคอมพิวเตอร์", "Computer Programming", "2.1"),
      needsReview: true,
      reviewReasons: ["ขาดหัวข้อ: สมรรถนะรายวิชา"],
    },
    ...Array.from({ length: 13 }, (_, i) =>
      base(`31900-10${String(i + 1).padStart(2, "0")}`, `วิชาชีพพื้นฐาน ${i + 1}`, `Basic Vocational ${i + 1}`, "2.1"),
    ),
  ],
};

/** Program 21901 (ปวช.): shares 30000-1101 with 31901 and has one course of its own. */
export const sampleDataPvc: Extracted = {
  categories: [
    { code: "1", name: "หมวดวิชาสมรรถนะแกนกลาง", minCredits: 22, parentCode: null, sortOrder: 0 },
    { code: "2", name: "หมวดวิชาสมรรถนะวิชาชีพ", minCredits: 56, parentCode: null, sortOrder: 1 },
  ],
  courses: [
    { ...sampleData.courses[0], categoryCode: "1" },
    base("21900-1001", "คอมพิวเตอร์และสารสนเทศเพื่องานอาชีพ", "Computer and Information for Careers", "2"),
  ],
};
