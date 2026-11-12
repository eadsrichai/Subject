import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";
import type { ActionResult, SessionUser } from "./authz";
import { db } from "./db";
import { fieldErrors } from "./validation";

// Account rules. Callers (server actions) have already established who `actor` is.

const GONE: ActionResult = { ok: false, errors: { _: "ไม่พบข้อมูล อาจถูกลบไปแล้ว" } };
const fail = (field: string, message: string): ActionResult => ({ ok: false, errors: { [field]: message } });

const password = z
  .string()
  .min(8, "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร")
  .max(200, "รหัสผ่านยาวเกิน 200 ตัวอักษร");
const name = z.string().trim().min(1, "กรุณากรอกชื่อ").max(200, "ชื่อยาวเกิน 200 ตัวอักษร");
const role = z.enum(["ADMIN", "STAFF"], { errorMap: () => ({ message: "เลือกบทบาทไม่ถูกต้อง" }) });
const checkbox = z.preprocess((v) => v === true || v === "on" || v === "true", z.boolean());

const createSchema = z.object({
  email: z.string().trim().toLowerCase().email("อีเมลไม่ถูกต้อง").max(254, "อีเมลไม่ถูกต้อง"),
  name,
  password,
  role,
});
const updateSchema = z.object({ name, role, active: checkbox });

const hash = (plain: string) => bcrypt.hash(plain, 10);

export async function createUser(_actor: SessionUser, input: unknown): Promise<ActionResult> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const { password: plain, ...fields } = parsed.data;
  try {
    await db.user.create({ data: { ...fields, passwordHash: await hash(plain) } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return fail("email", "อีเมลนี้มีอยู่แล้ว");
    }
    throw err;
  }
  return { ok: true };
}

export async function updateUser(actor: SessionUser, id: number, input: unknown): Promise<ActionResult> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const next = parsed.data;
  const staysActiveAdmin = next.role === "ADMIN" && next.active;

  if (id === actor.id && !staysActiveAdmin) {
    return fail("_", "ไม่สามารถเปลี่ยนบทบาทหรือปิดการใช้งานบัญชีของตนเองได้");
  }

  // Check and write together so two simultaneous demotions cannot both pass.
  return db.$transaction(
    async (tx) => {
      const target = await tx.user.findUnique({ where: { id } });
      if (!target) return GONE;
      const wasActiveAdmin = target.role === "ADMIN" && target.active;
      if (wasActiveAdmin && !staysActiveAdmin) {
        const others = await tx.user.count({ where: { role: "ADMIN", active: true, id: { not: id } } });
        if (others === 0) return fail("_", "ต้องมีผู้ดูแลระบบที่ใช้งานได้อย่างน้อยหนึ่งคน");
      }
      await tx.user.update({ where: { id }, data: next });
      return { ok: true } as ActionResult;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function resetPassword(_actor: SessionUser, id: number, newPassword: string): Promise<ActionResult> {
  const parsed = password.safeParse(newPassword);
  if (!parsed.success) return fail("password", parsed.error.issues[0].message);
  const { count } = await db.user.updateMany({ where: { id }, data: { passwordHash: await hash(parsed.data) } });
  return count === 0 ? GONE : { ok: true };
}

export async function changeOwnPassword(actor: SessionUser, current: string, next: string): Promise<ActionResult> {
  const user = await db.user.findUnique({ where: { id: actor.id } });
  if (!user) return GONE;
  if (!(await bcrypt.compare(current, user.passwordHash))) {
    return fail("current", "รหัสผ่านปัจจุบันไม่ถูกต้อง");
  }
  const parsed = password.safeParse(next);
  if (!parsed.success) return fail("password", parsed.error.issues[0].message);
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hash(parsed.data) } });
  return { ok: true };
}
