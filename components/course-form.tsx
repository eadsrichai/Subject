"use client";

import Link from "next/link";
import type { ActionResult } from "@/lib/authz";
import { parsePlacements } from "@/lib/validation";
import { Field, FormError, TextArea, useFormAction } from "./form";
import { PlacementsField, type PlacementProgram } from "./placements-field";

export type CourseFormValues = {
  code: string;
  nameTh: string;
  nameEn: string;
  theoryHours: number | null;
  practiceHours: number | null;
  credits: number | null;
  standardRef: string | null;
  learningOutcome: string | null;
  objectives: string | null;
  competencies: string | null;
  description: string | null;
  needsReview: boolean;
  reviewNote: string | null;
  /** Where the course is now, as stored. */
  placements: { programId: number; categoryId: number; sourcePage: number | null }[];
};

type Props = {
  action: (formData: FormData) => Promise<ActionResult>;
  course: CourseFormValues;
  programs: PlacementProgram[];
  /** A new course starts with one empty program row. */
  startWithRow?: boolean;
};

const SECTIONS = [
  ["standardRef", "อ้างอิงมาตรฐาน", 2],
  ["learningOutcome", "ผลลัพธ์การเรียนรู้ระดับรายวิชา", 3],
  ["objectives", "จุดประสงค์รายวิชา", 5],
  ["competencies", "สมรรถนะรายวิชา", 5],
  ["description", "คำอธิบายรายวิชา", 6],
] as const;

export function CourseForm({ action, course, programs, startWithRow }: Props) {
  const { formAction, pending, errors, value, checked, attempt, submitted } = useFormAction(action);
  // After a failed save, show the rows as submitted; otherwise the stored placements.
  const placements = submitted
    ? (parsePlacements(submitted) as { programId: string; categoryId: string }[])
    : startWithRow
      ? [{ programId: programs.length === 1 ? programs[0].id : "", categoryId: "" }]
      : course.placements;
  const sourcePage = course.placements.find((p) => p.sourcePage !== null)?.sourcePage;

  return (
    // Remount on a failed attempt so every field shows what was submitted.
    <form key={attempt} action={formAction} className="card space-y-4 p-5">
      <FormError message={errors._} />

      {course.placements.length > 1 && (
        <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          เนื้อหาวิชานี้ใช้ร่วมกับ {course.placements.length} สาขา แก้แล้วมีผลทุกสาขา
        </p>
      )}

      {course.reviewNote && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          หมายเหตุจากการนำเข้า: {course.reviewNote}
          {sourcePage && ` (PDF หน้า ${sourcePage})`}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
        <Field
          name="code"
          label="รหัสวิชา"
          defaultValue={value("code", course.code)}
          error={errors.code}
          placeholder="00000-0000"
          className="font-mono"
        />
        <Field name="nameTh" label="ชื่อวิชา (ไทย)" defaultValue={value("nameTh", course.nameTh)} error={errors.nameTh} />
      </div>
      <Field name="nameEn" label="ชื่อวิชา (อังกฤษ)" defaultValue={value("nameEn", course.nameEn)} error={errors.nameEn} />

      <div className="grid gap-4 sm:grid-cols-[repeat(3,8rem)]">
        <Field name="theoryHours" label="ทฤษฎี (ชม.)" inputMode="numeric" defaultValue={value("theoryHours", course.theoryHours)} error={errors.theoryHours} />
        <Field name="practiceHours" label="ปฏิบัติ (ชม.)" inputMode="numeric" defaultValue={value("practiceHours", course.practiceHours)} error={errors.practiceHours} />
        <Field name="credits" label="หน่วยกิต" inputMode="numeric" defaultValue={value("credits", course.credits)} error={errors.credits} />
      </div>

      <PlacementsField programs={programs} initial={placements} errors={errors} />

      {SECTIONS.map(([name, label, rows]) => (
        <TextArea key={name} name={name} label={label} rows={rows} defaultValue={value(name, course[name])} error={errors[name]} />
      ))}

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="needsReview" defaultChecked={checked("needsReview", course.needsReview)} />
        ต้องตรวจสอบ
      </label>

      <div className="flex gap-3">
        <button type="submit" className="btn" disabled={pending}>
          {pending ? "กำลังบันทึก…" : "บันทึก"}
        </button>
        <Link href="/admin/courses" className="btn-secondary">
          ยกเลิก
        </Link>
      </div>
    </form>
  );
}
