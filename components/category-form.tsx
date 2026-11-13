"use client";

import Link from "next/link";
import type { ActionResult } from "@/lib/authz";
import { Field, FieldError, FormError, useFormAction } from "./form";

type Props = {
  action: (formData: FormData) => Promise<ActionResult>;
  /** The program a new category is added to. */
  programId: number;
  /** null when adding a new category. */
  category: { code: string; name: string; minCredits: number | null; parentId: number | null; sortOrder: number } | null;
  /** Categories that may be chosen as the parent. */
  parents: { id: number; code: string; name: string; depth: number }[];
};

export function CategoryForm({ action, programId, category, parents }: Props) {
  const { formAction, pending, errors, value, saved, attempt } = useFormAction(action);
  const editing = category !== null;

  return (
    <form key={attempt} action={formAction} className="card space-y-4 p-5">
      <h2 className="font-semibold">{editing ? `แก้ไขหมวด ${category.code}` : "เพิ่มหมวดวิชา"}</h2>
      <input type="hidden" name="programId" value={programId} />
      <FormError message={errors._} />
      <FormError message={errors.programId} />
      {saved && !editing && <p className="text-sm text-teal-800">เพิ่มหมวดวิชาแล้ว</p>}

      <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
        <Field name="code" label="รหัสหมวด" defaultValue={value("code", category?.code)} error={errors.code} placeholder="เช่น 2.3" />
        <Field name="name" label="ชื่อหมวด" defaultValue={value("name", category?.name)} error={errors.name} />
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_10rem_8rem]">
        <div>
          <label htmlFor="parentId" className="field-label">
            อยู่ภายใต้หมวด
          </label>
          <select id="parentId" name="parentId" defaultValue={value("parentId", category?.parentId)} className="field">
            <option value="">— ไม่มี (หมวดระดับบนสุด) —</option>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>
                {"  ".repeat(p.depth)}
                {p.code} {p.name}
              </option>
            ))}
          </select>
          <FieldError message={errors.parentId} />
        </div>
        <Field name="minCredits" label="หน่วยกิตขั้นต่ำ" inputMode="numeric" defaultValue={value("minCredits", category?.minCredits)} error={errors.minCredits} />
        <Field name="sortOrder" label="ลำดับ" inputMode="numeric" defaultValue={value("sortOrder", category?.sortOrder ?? 0)} error={errors.sortOrder} />
      </div>

      <div className="flex gap-3">
        <button type="submit" className="btn" disabled={pending}>
          {editing ? "บันทึก" : "เพิ่มหมวดวิชา"}
        </button>
        {editing && (
          <Link href="/admin/categories" className="btn-secondary">
            ยกเลิก
          </Link>
        )}
      </div>
    </form>
  );
}
