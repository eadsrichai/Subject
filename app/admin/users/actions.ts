"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { runAs, type ActionResult } from "@/lib/authz";
import { createUser, resetPassword, updateUser } from "@/lib/users";

export async function createUserAction(formData: FormData): Promise<ActionResult> {
  const result = await runAs(["ADMIN"], (actor) => createUser(actor, Object.fromEntries(formData)));
  if (result.ok) revalidatePath("/admin/users");
  return result;
}

export async function updateUserAction(id: number, formData: FormData): Promise<ActionResult> {
  const result = await runAs(["ADMIN"], (actor) => updateUser(actor, id, Object.fromEntries(formData)));
  if (!result.ok) return result;
  revalidatePath("/admin/users");
  redirect("/admin/users");
}

export async function resetPasswordAction(id: number, formData: FormData): Promise<ActionResult> {
  return runAs(["ADMIN"], (actor) => resetPassword(actor, id, String(formData.get("password") ?? "")));
}
