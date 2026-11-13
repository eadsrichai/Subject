"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { withBasePath } from "@/lib/base-path";

export type LoginState = { error?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  try {
    await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      redirectTo: withBasePath("/admin"),
    });
  } catch (err) {
    // Same message whether the email is unknown, the password is wrong, or the account is disabled.
    if (err instanceof AuthError) return { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
    throw err; // the success redirect is thrown too
  }
  return {};
}

export async function logout() {
  await signOut({ redirectTo: withBasePath("/login") });
}
