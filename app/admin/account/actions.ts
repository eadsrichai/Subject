"use server";

import { runAs, type ActionResult } from "@/lib/authz";
import { changeOwnPassword } from "@/lib/users";

export async function changePasswordAction(formData: FormData): Promise<ActionResult> {
  return runAs(["ADMIN", "STAFF"], (actor) =>
    changeOwnPassword(actor, String(formData.get("current") ?? ""), String(formData.get("password") ?? "")),
  );
}
