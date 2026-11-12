import { expect, test } from "vitest";
import { checkAccess } from "@/lib/authz";
import { db } from "@/lib/db";
import { mkUser } from "./helpers";

test("ไม่มี session → UNAUTHENTICATED", async () =>
  await expect(checkAccess(null, ["ADMIN"])).rejects.toMatchObject({ reason: "UNAUTHENTICATED" }));

test("ผู้ใช้ถูกลบแล้ว → UNAUTHENTICATED", async () =>
  await expect(checkAccess(9999, ["ADMIN"])).rejects.toMatchObject({ reason: "UNAUTHENTICATED" }));

test("ถูกปิดการใช้งานหลังล็อกอิน → UNAUTHENTICATED", async () => {
  const u = await mkUser({ role: "ADMIN", active: false });
  await expect(checkAccess(u.id, ["ADMIN"])).rejects.toMatchObject({ reason: "UNAUTHENTICATED" });
});

test("STAFF เรียกสิ่งที่ต้องเป็น ADMIN → FORBIDDEN", async () => {
  const u = await mkUser({ role: "STAFF" });
  await expect(checkAccess(u.id, ["ADMIN"])).rejects.toMatchObject({ reason: "FORBIDDEN" });
});

test("ใช้บทบาทปัจจุบันใน DB ไม่ใช่ที่ฝังใน session", async () => {
  const u = await mkUser({ role: "ADMIN" });
  await db.user.update({ where: { id: u.id }, data: { role: "STAFF" } });
  await expect(checkAccess(u.id, ["ADMIN"])).rejects.toMatchObject({ reason: "FORBIDDEN" });
});

test("ผ่าน และคืนข้อมูลผู้ใช้โดยไม่มี hash รหัสผ่าน", async () => {
  const u = await mkUser({ role: "STAFF" });
  expect(await checkAccess(u.id, ["ADMIN", "STAFF"])).toEqual({
    id: u.id,
    email: u.email,
    name: u.name,
    role: "STAFF",
  });
});

test("id ที่ไม่ใช่จำนวนเต็ม → UNAUTHENTICATED ไม่ล้ม", async () =>
  await expect(checkAccess(Number.NaN, ["ADMIN"])).rejects.toMatchObject({ reason: "UNAUTHENTICATED" }));
