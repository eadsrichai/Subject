"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { runAs, type ActionResult } from "@/lib/authz";
import { deleteCategory, saveCategory } from "@/lib/course-admin";

const EDITORS = ["ADMIN", "STAFF"] as const;

export async function saveCategoryAction(id: number | null, formData: FormData): Promise<ActionResult> {
  const result = await runAs([...EDITORS], () => saveCategory(id, Object.fromEntries(formData)));
  if (!result.ok) return result;
  revalidatePath("/", "layout");
  // Editing returns to the plain list; adding stays there with an empty form.
  if (id !== null) redirect("/admin/categories");
  return result;
}

export async function deleteCategoryAction(id: number): Promise<ActionResult> {
  const result = await runAs([...EDITORS], () => deleteCategory(id));
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
