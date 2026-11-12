import type { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/authz";

let n = 0;

export async function mkUser(over: { role?: Role; active?: boolean; email?: string; password?: string } = {}) {
  n++;
  return db.user.create({
    data: {
      email: over.email ?? `user${n}@test.local`,
      name: `ผู้ใช้ ${n}`,
      role: over.role ?? "STAFF",
      active: over.active ?? true,
      // cost 4: these tests exercise rules, not hashing strength
      passwordHash: await bcrypt.hash(over.password ?? "password-1234", 4),
    },
  });
}

export const actor = (u: { id: number; email: string; name: string; role: Role }): SessionUser => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role,
});
