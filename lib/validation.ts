import { z } from "zod";
import { normalizeThai } from "./normalize-thai";

// Form values arrive as strings; these helpers accept both strings and already-typed values.

const blankToUndefined = (v: unknown) => (typeof v === "string" ? (v.trim() === "" ? undefined : Number(v)) : v);

const wholeNumber = (min: number, max: number, message: string) =>
  z.preprocess(
    blankToUndefined,
    z.number({ required_error: message, invalid_type_error: message }).int(message).min(min, message).max(max, message),
  );

const optionalWholeNumber = (max: number, message: string) =>
  z.preprocess(
    (v) => (v === undefined || v === null || (typeof v === "string" && v.trim() === "") ? null : blankToUndefined(v)),
    z.number({ invalid_type_error: message }).int(message).min(0, message).max(max, message).nullable(),
  );

// Text pasted from the curriculum PDF carries broken Thai glyphs; repair it the way the importer does.
const thaiLine = (v: unknown) => (typeof v === "string" ? normalizeThai(v) : v);
// Long text keeps its line breaks; each line is repaired on its own.
const thaiLines = (v: unknown) =>
  typeof v === "string" ? v.split(/\r?\n/).map(normalizeThai).join("\n").trim() : v;

const longText = (max: number) =>
  z
    .preprocess((v) => thaiLines(v ?? ""), z.string().max(max, `ยาวเกิน ${max.toLocaleString("en-US")} ตัวอักษร`))
    .transform((s) => (s === "" ? null : s));

const HOURS_MESSAGE = "ต้องเป็นจำนวนเต็ม 0–99";

export const courseSchema = z.object({
  code: z.string().trim().regex(/^\d{5}-\d{4}$/, "รหัสวิชาต้องอยู่ในรูปแบบ 00000-0000"),
  nameTh: z.preprocess(thaiLine, z.string().min(1, "กรุณากรอกชื่อวิชา").max(300, "ชื่อวิชายาวเกิน 300 ตัวอักษร")),
  nameEn: z.preprocess((v) => thaiLine(v ?? ""), z.string().max(300, "ชื่อวิชายาวเกิน 300 ตัวอักษร")),
  theoryHours: wholeNumber(0, 99, HOURS_MESSAGE),
  practiceHours: wholeNumber(0, 99, HOURS_MESSAGE),
  credits: wholeNumber(0, 99, HOURS_MESSAGE),
  categoryId: wholeNumber(1, 2_000_000_000, "กรุณาเลือกหมวดวิชา"),
  standardRef: longText(10_000),
  learningOutcome: longText(10_000),
  objectives: longText(10_000),
  competencies: longText(10_000),
  description: longText(10_000),
  needsReview: z.preprocess((v) => v === true || v === "on" || v === "true", z.boolean()),
});
export type CourseInput = z.infer<typeof courseSchema>;

export const categorySchema = z.object({
  programId: wholeNumber(1, 2_000_000_000, "ไม่พบสาขาที่เลือก"),
  code: z.string().trim().min(1, "กรุณากรอกรหัสหมวด").max(20, "รหัสหมวดยาวเกิน 20 ตัวอักษร"),
  name: z.preprocess(thaiLine, z.string().min(1, "กรุณากรอกชื่อหมวด").max(300, "ชื่อหมวดยาวเกิน 300 ตัวอักษร")),
  minCredits: optionalWholeNumber(999, "ต้องเป็นจำนวนเต็ม 0–999"),
  parentId: optionalWholeNumber(2_000_000_000, "เลือกหมวดแม่ไม่ถูกต้อง"),
  sortOrder: z.preprocess((v) => blankToUndefined(v) ?? 0, z.number().int().min(0).max(9999)),
  note: longText(1000),
});
export type CategoryInput = z.infer<typeof categorySchema>;

/** First message per field, keyed by field name — the shape forms display. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_");
    out[key] ??= issue.message;
  }
  return out;
}
