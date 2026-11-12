import bcrypt from "bcryptjs";
import { expect, test } from "vitest";
import { checkAccess } from "@/lib/authz";
import { db } from "@/lib/db";
import { changeOwnPassword, createUser, resetPassword, updateUser } from "@/lib/users";
import { actor, mkUser } from "./helpers";

const SELF = "ไม่สามารถเปลี่ยนบทบาทหรือปิดการใช้งานบัญชีของตนเองได้";
const LAST_ADMIN = "ต้องมีผู้ดูแลระบบที่ใช้งานได้อย่างน้อยหนึ่งคน";

test("สร้างผู้ใช้: อีเมลถูก normalize และรหัสผ่านถูกเก็บเป็น hash", async () => {
  const admin = actor(await mkUser({ role: "ADMIN" }));
  expect(await createUser(admin, { email: " New@Test.Local ", name: "ครูใหม่", password: "secret-123", role: "STAFF" })).toEqual({ ok: true });
  const u = await db.user.findUniqueOrThrow({ where: { email: "new@test.local" } });
  expect(u).toMatchObject({ name: "ครูใหม่", role: "STAFF", active: true });
  expect(u.passwordHash).not.toContain("secret-123");
  expect(await bcrypt.compare("secret-123", u.passwordHash)).toBe(true);
});

test("อีเมลซ้ำ (ไม่สนตัวพิมพ์) → errors.email", async () => {
  const admin = actor(await mkUser({ role: "ADMIN", email: "boss@test.local" }));
  expect(await createUser(admin, { email: "BOSS@test.local", name: "ซ้ำ", password: "secret-123", role: "STAFF" })).toEqual({
    ok: false,
    errors: { email: "อีเมลนี้มีอยู่แล้ว" },
  });
});

test("ข้อมูลผู้ใช้ไม่ถูกต้อง → ข้อผิดพลาดรายช่อง", async () => {
  const admin = actor(await mkUser({ role: "ADMIN" }));
  expect(await createUser(admin, { email: "not-an-email", name: " ", password: "short", role: "ROOT" })).toEqual({
    ok: false,
    errors: {
      email: "อีเมลไม่ถูกต้อง",
      name: "กรุณากรอกชื่อ",
      password: "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร",
      role: "เลือกบทบาทไม่ถูกต้อง",
    },
  });
  expect(await db.user.count()).toBe(1);
});

test("ADMIN ปิดการใช้งานหรือลดบทบาทตนเองไม่ได้ แต่เปลี่ยนชื่อตนเองได้", async () => {
  const me = await mkUser({ role: "ADMIN" });
  await mkUser({ role: "ADMIN" });
  const self = { ok: false, errors: { _: SELF } };
  expect(await updateUser(actor(me), me.id, { name: me.name, role: "STAFF", active: "on" })).toEqual(self);
  expect(await updateUser(actor(me), me.id, { name: me.name, role: "ADMIN" })).toEqual(self);
  expect(await updateUser(actor(me), me.id, { name: "ชื่อใหม่", role: "ADMIN", active: "on" })).toEqual({ ok: true });
  expect(await db.user.findUniqueOrThrow({ where: { id: me.id } })).toMatchObject({ name: "ชื่อใหม่", role: "ADMIN", active: true });
});

test("ลดบทบาท/ปิด ADMIN คนสุดท้ายที่ใช้งานได้ไม่ได้ แม้ผู้สั่งมี session ค้างจากบัญชีที่ถูกปิดแล้ว", async () => {
  const last = await mkUser({ role: "ADMIN" });
  const stale = actor(await mkUser({ role: "ADMIN", active: false }));
  const blocked = { ok: false, errors: { _: LAST_ADMIN } };
  expect(await updateUser(stale, last.id, { name: last.name, role: "STAFF", active: "on" })).toEqual(blocked);
  expect(await updateUser(stale, last.id, { name: last.name, role: "ADMIN" })).toEqual(blocked);
  expect(await db.user.findUniqueOrThrow({ where: { id: last.id } })).toMatchObject({ role: "ADMIN", active: true });
});

test("มี ADMIN ใช้งานได้สองคน ลดบทบาทอีกคนหนึ่งได้", async () => {
  const me = await mkUser({ role: "ADMIN" });
  const other = await mkUser({ role: "ADMIN" });
  expect(await updateUser(actor(me), other.id, { name: other.name, role: "STAFF", active: "on" })).toEqual({ ok: true });
  expect((await db.user.findUniqueOrThrow({ where: { id: other.id } })).role).toBe("STAFF");
});

test("ผู้ใช้ที่ถูกปิดการใช้งานถูก checkAccess ปฏิเสธ", async () => {
  const me = await mkUser({ role: "ADMIN" });
  const staff = await mkUser({ role: "STAFF" });
  expect(await updateUser(actor(me), staff.id, { name: staff.name, role: "STAFF" })).toEqual({ ok: true });
  await expect(checkAccess(staff.id, ["ADMIN", "STAFF"])).rejects.toMatchObject({ reason: "UNAUTHENTICATED" });
});

test("แก้ไข/รีเซ็ตรหัสผ่านผู้ใช้ที่ไม่มีแล้ว → errors._", async () => {
  const me = actor(await mkUser({ role: "ADMIN" }));
  const gone = { ok: false, errors: { _: "ไม่พบข้อมูล อาจถูกลบไปแล้ว" } };
  expect(await updateUser(me, 424242, { name: "x", role: "STAFF", active: "on" })).toEqual(gone);
  expect(await resetPassword(me, 424242, "new-secret-1")).toEqual(gone);
});

test("resetPassword: สั้นเกินไปถูกปฏิเสธ; ถูกต้องแล้วใช้รหัสใหม่ได้", async () => {
  const me = actor(await mkUser({ role: "ADMIN" }));
  const staff = await mkUser({ role: "STAFF" });
  expect(await resetPassword(me, staff.id, "short")).toEqual({
    ok: false,
    errors: { password: "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร" },
  });
  expect(await resetPassword(me, staff.id, "new-secret-1")).toEqual({ ok: true });
  const after = await db.user.findUniqueOrThrow({ where: { id: staff.id } });
  expect(await bcrypt.compare("new-secret-1", after.passwordHash)).toBe(true);
});

test("changeOwnPassword: รหัสเดิมผิดถูกปฏิเสธ; ถูกแล้วเปลี่ยนได้", async () => {
  const u = await mkUser({ role: "STAFF", password: "old-secret-1" });
  expect(await changeOwnPassword(actor(u), "wrong", "new-secret-1")).toEqual({
    ok: false,
    errors: { current: "รหัสผ่านปัจจุบันไม่ถูกต้อง" },
  });
  expect(await changeOwnPassword(actor(u), "old-secret-1", "short")).toEqual({
    ok: false,
    errors: { password: "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร" },
  });
  expect(await changeOwnPassword(actor(u), "old-secret-1", "new-secret-1")).toEqual({ ok: true });
  const after = await db.user.findUniqueOrThrow({ where: { id: u.id } });
  expect(await bcrypt.compare("new-secret-1", after.passwordHash)).toBe(true);
});
