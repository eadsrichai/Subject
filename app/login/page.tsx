"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-xl font-semibold">เข้าสู่ระบบผู้ดูแล</h1>
      <form action={action} className="card mt-4 space-y-4 p-5">
        <div>
          <label htmlFor="email" className="field-label">
            อีเมล
          </label>
          <input id="email" name="email" type="email" autoComplete="username" required className="field" />
        </div>
        <div>
          <label htmlFor="password" className="field-label">
            รหัสผ่าน
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="field"
          />
        </div>
        {state.error && (
          <p role="alert" className="field-error">
            {state.error}
          </p>
        )}
        <button type="submit" className="btn w-full" disabled={pending}>
          {pending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
        </button>
      </form>
      <p className="mt-4 text-sm">
        <Link href="/" className="link">
          กลับไปหน้ารายวิชา
        </Link>
      </p>
    </main>
  );
}
