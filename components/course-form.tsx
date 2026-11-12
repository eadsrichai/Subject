"use client";

import Link from "next/link";
import type { ActionResult } from "@/lib/authz";
import { Field, FieldError, FormError, TextArea, useFormAction } from "./form";

export type CourseFormValues = {
  code: string;
  nameTh: string;
  nameEn: string;
  theoryHours: number | null;
  practiceHours: number | null;
  credits: number | null;
  categoryId: number | null;
  standardRef: string | null;
  learningOutcome: string | null;
  objectives: string | null;
  competencies: string | null;
  description: string | null;
  needsReview: boolean;
  reviewNote: string | null;
  sourcePage: number | null;
};

type Props = {
  action: (formData: FormData) => Promise<ActionResult>;
  course: CourseFormValues;
  categories: { id: number; code: string; name: string; depth: number }[];
};

const SECTIONS = [
  ["standardRef", "อ้างอิงมาตรฐาน", 2],
  ["learningOutcome", "ผลลัพธ์การเรียนรู้ระดับรายวิชา", 3],
  ["objectives", "จุดประสงค์รายวิชา", 5],
  ["competencies", "สมรรถนะรายวิชา", 5],
  ["description", "คำอธิบายรายวิชา", 6],
] as const;

export function CourseForm({ action, course, categories }: Props) {
  const { formAction, pending, errors, value, checked, attempt } = useFormAction(action);

  return (
    // Remount on a failed attempt so every field shows what was submitted.
    <form key={attempt} action={formAction} className="card space-y-4 p-5">
      <FormError message={errors._} />

      {course.reviewNote && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          หมายเหตุจากการนำเข้า: {course.reviewNote}
          {course.sourcePage && ` (PDF หน้า ${course.sourcePage})`}
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

      <div className="grid gap-4 sm:grid-cols-[repeat(3,8rem)_1fr]">
        <Field name="theoryHours" label="ทฤษฎี (ชม.)" inputMode="numeric" defaultValue={value("theoryHours", course.theoryHours)} error={errors.theoryHours} />
        <Field name="practiceHours" label="ปฏิบัติ (ชม.)" inputMode="numeric" defaultValue={value("practiceHours", course.practiceHours)} error={errors.practiceHours} />
        <Field name="credits" label="หน่วยกิต" inputMode="numeric" defaultValue={value("credits", course.credits)} error={errors.credits} />
        <div>
          <label htmlFor="categoryId" className="field-label">
            หมวด/กลุ่มวิชา
          </label>
          <select id="categoryId" name="categoryId" defaultValue={value("categoryId", course.categoryId)} className="field">
            <option value="">— เลือกหมวดวิชา —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {"  ".repeat(c.depth)}
                {c.code} {c.name}
              </option>
            ))}
          </select>
          <FieldError message={errors.categoryId} />
        </div>
      </div>

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
