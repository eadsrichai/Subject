"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { runAs, type ActionResult } from "@/lib/authz";
import { deleteProgram, saveProgram } from "@/lib/programs";

const EDITORS = ["ADMIN", "STAFF"] as const;

export async function saveProgramAction(id: number | null, formData: FormData): Promise<ActionResult> {
  const result = await runAs([...EDITORS], () => saveProgram(id, Object.fromEntries(formData)));
  if (!result.ok) return result;
  revalidatePath("/", "layout");
  // Editing returns to the plain list; adding stays there with an empty form.
  if (id !== null) redirect("/admin/programs");
  return result;
}

export async function deleteProgramAction(id: number): Promise<ActionResult> {
  const result = await runAs([...EDITORS], () => deleteProgram(id));
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
