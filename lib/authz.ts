import type { Role } from "@prisma/client";
import { db } from "./db";

export class AuthzError extends Error {
  constructor(public reason: "UNAUTHENTICATED" | "FORBIDDEN") {
    super(reason);
    this.name = "AuthzError";
  }
}

export type SessionUser = { id: number; email: string; name: string; role: Role };

/** Result of a server action; key "_" holds an error for the form as a whole. */
export type ActionResult = { ok: true } | { ok: false; errors: Record<string, string> };

export const FORBIDDEN_MESSAGE = "คุณไม่มีสิทธิ์ดำเนินการนี้";

/**
 * Decides access from the database row, not the session token: a user who was
 * deactivated or demoted after signing in loses access on their next request.
 */
export async function checkAccess(userId: number | null, allowed: Role[]): Promise<SessionUser> {
  if (userId === null || !Number.isInteger(userId)) throw new AuthzError("UNAUTHENTICATED");
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, active: true },
  });
  if (!user || !user.active) throw new AuthzError("UNAUTHENTICATED");
  if (!allowed.includes(user.role)) throw new AuthzError("FORBIDDEN");
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

/** The signed-in user if they hold one of the roles; throws AuthzError otherwise. */
export async function requireRole(...allowed: Role[]): Promise<SessionUser> {
  const { auth } = await import("@/auth");
  const session = await auth();
  const id = session?.user?.id;
  return checkAccess(id ? Number(id) : null, allowed);
}

/** For pages: sends anyone without a valid session to the login page. */
export async function requireRoleOrLogin(...allowed: Role[]): Promise<SessionUser> {
  try {
    return await requireRole(...allowed);
  } catch (err) {
    if (err instanceof AuthzError && err.reason === "UNAUTHENTICATED") {
      const { redirect } = await import("next/navigation");
      redirect("/login");
    }
    throw err;
  }
}

/** For server actions: checks the role, then runs the action as that user. */
export async function runAs(
  allowed: Role[],
  action: (user: SessionUser) => Promise<ActionResult>,
): Promise<ActionResult> {
  let user: SessionUser;
  try {
    user = await requireRoleOrLogin(...allowed);
  } catch (err) {
    if (err instanceof AuthzError) return { ok: false, errors: { _: FORBIDDEN_MESSAGE } };
    throw err;
  }
  return action(user);
}
