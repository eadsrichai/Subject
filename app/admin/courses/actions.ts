"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { runAs, type ActionResult } from "@/lib/authz";
import { deleteCourse, saveCourse } from "@/lib/course-admin";
import { parsePlacements } from "@/lib/validation";

const EDITORS = ["ADMIN", "STAFF"] as const;

export async function saveCourseAction(id: number | null, formData: FormData): Promise<ActionResult> {
  const form = Object.fromEntries(formData);
  const result = await runAs([...EDITORS], () => saveCourse(id, { ...form, placements: parsePlacements(form) }));
  if (!result.ok) return result;
  revalidatePath("/", "layout");
  redirect("/admin/courses");
}

export async function deleteCourseAction(id: number): Promise<ActionResult> {
  const result = await runAs([...EDITORS], () => deleteCourse(id));
  if (!result.ok) return result;
  revalidatePath("/", "layout");
  redirect("/admin/courses");
}
