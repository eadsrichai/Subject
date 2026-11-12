"use client";

import Link from "next/link";
import type { ActionResult } from "@/lib/authz";
import { Field, FieldError, FormError, useFormAction } from "./form";

type Action = (formData: FormData) => Promise<ActionResult>;

function RoleSelect({ value, error }: { value: string; error?: string }) {
  return (
    <div>
      <label htmlFor="role" className="field-label">
        บทบาท
      </label>
      <select id="role" name="role" defaultValue={value || "STAFF"} className="field">
        <option value="STAFF">เจ้าหน้าที่ — แก้ไขรายวิชาและหมวดวิชา</option>
        <option value="ADMIN">ผู้ดูแลระบบ — จัดการผู้ใช้ได้ด้วย</option>
      </select>
      <FieldError message={error} />
    </div>
  );
}

export function CreateUserForm({ action }: { action: Action }) {
  const { formAction, pending, errors, value, saved, attempt } = useFormAction(action);
  return (
    <form key={attempt} action={formAction} className="card space-y-4 p-5">
      <h2 className="font-semibold">เพิ่มผู้ใช้</h2>
      <FormError message={errors._} />
      {saved && <p className="text-sm text-teal-800">เพิ่มผู้ใช้แล้ว</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="email" label="อีเมล" type="email" autoComplete="off" defaultValue={value("email")} error={errors.email} />
        <Field name="name" label="ชื่อ" defaultValue={value("name")} error={errors.name} />
        <Field
          name="password"
          label="รหัสผ่าน"
          type="password"
          autoComplete="new-password"
          error={errors.password}
          hint="อย่างน้อย 8 ตัวอักษร แจ้งผู้ใช้ให้เปลี่ยนหลังเข้าสู่ระบบครั้งแรก"
        />
        <RoleSelect value={value("role")} error={errors.role} />
      </div>
      <button type="submit" className="btn" disabled={pending}>
        เพิ่มผู้ใช้
      </button>
    </form>
  );
}

export function EditUserForm({
  action,
  user,
}: {
  action: Action;
  user: { email: string; name: string; role: string; active: boolean };
}) {
  const { formAction, pending, errors, value, checked, attempt } = useFormAction(action);
  return (
    <form key={attempt} action={formAction} className="card space-y-4 p-5">
      <h2 className="font-semibold">แก้ไขผู้ใช้ {user.email}</h2>
      <FormError message={errors._} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="name" label="ชื่อ" defaultValue={value("name", user.name)} error={errors.name} />
        <RoleSelect value={value("role", user.role)} error={errors.role} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={checked("active", user.active)} />
        เปิดใช้งาน
      </label>
      <div className="flex gap-3">
        <button type="submit" className="btn" disabled={pending}>
          บันทึก
        </button>
        <Link href="/admin/users" className="btn-secondary">
          ยกเลิก
        </Link>
      </div>
    </form>
  );
}

export function PasswordForm({
  action,
  title,
  askCurrent,
  submitLabel,
  savedMessage,
}: {
  action: Action;
  title: string;
  askCurrent: boolean;
  submitLabel: string;
  savedMessage: string;
}) {
  const { formAction, pending, errors, saved } = useFormAction(action);
  return (
    <form action={formAction} className="card max-w-md space-y-4 p-5">
      <h2 className="font-semibold">{title}</h2>
      <FormError message={errors._} />
      {saved && (
        <p role="status" className="text-sm text-teal-800">
          {savedMessage}
        </p>
      )}
      {askCurrent && (
        <Field name="current" label="รหัสผ่านปัจจุบัน" type="password" autoComplete="current-password" error={errors.current} />
      )}
      <Field
        name="password"
        label="รหัสผ่านใหม่"
        type="password"
        autoComplete="new-password"
        error={errors.password}
        hint="อย่างน้อย 8 ตัวอักษร"
      />
      <button type="submit" className="btn" disabled={pending}>
        {submitLabel}
      </button>
    </form>
  );
}
