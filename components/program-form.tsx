"use client";

import type { Level } from "@prisma/client";
import Link from "next/link";
import type { ActionResult } from "@/lib/authz";
import { Field, FieldError, FormError, useFormAction } from "./form";

type Props = {
  action: (formData: FormData) => Promise<ActionResult>;
  /** null when adding a new program. */
  program: { code: string; level: Level; name: string; typeName: string; sortOrder: number } | null;
};

export function ProgramForm({ action, program }: Props) {
  const { formAction, pending, errors, value, saved, attempt } = useFormAction(action);
  const editing = program !== null;

  return (
    <form key={attempt} action={formAction} className="card space-y-4 p-5">
      <h2 className="font-semibold">{editing ? `แก้ไขสาขา ${program.code}` : "เพิ่มสาขา"}</h2>
      <FormError message={errors._} />
      {saved && !editing && <p className="text-sm text-teal-800">เพิ่มสาขาแล้ว</p>}

      <div className="grid gap-4 sm:grid-cols-[8rem_10rem_1fr]">
        {editing ? (
          <div>
            <span className="field-label">รหัสสาขา</span>
            {/* The code is what URLs and booklets refer to, so it never changes. */}
            <p className="py-2 font-mono">{program.code}</p>
          </div>
        ) : (
          <Field
            name="code"
            label="รหัสสาขา"
            defaultValue={value("code")}
            error={errors.code}
            inputMode="numeric"
            placeholder="เช่น 31901"
            className="font-mono"
          />
        )}
        <div>
          <label htmlFor="level" className="field-label">
            ระดับ
          </label>
          <select id="level" name="level" defaultValue={value("level", program?.level)} className="field">
            <option value="">— เลือกระดับ —</option>
            <option value="PVC">ปวช.</option>
            <option value="PVS">ปวส.</option>
          </select>
          <FieldError message={errors.level} />
        </div>
        <Field name="name" label="ชื่อสาขา" defaultValue={value("name", program?.name)} error={errors.name} placeholder="เช่น เทคโนโลยีสารสนเทศ" />
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <Field name="typeName" label="ประเภทวิชา" defaultValue={value("typeName", program?.typeName)} error={errors.typeName} />
        <Field name="sortOrder" label="ลำดับ" inputMode="numeric" defaultValue={value("sortOrder", program?.sortOrder ?? 0)} error={errors.sortOrder} />
      </div>

      <div className="flex gap-3">
        <button type="submit" className="btn" disabled={pending}>
          {editing ? "บันทึก" : "เพิ่มสาขา"}
        </button>
        {editing && (
          <Link href="/admin/programs" className="btn-secondary">
            ยกเลิก
          </Link>
        )}
      </div>
    </form>
  );
}
