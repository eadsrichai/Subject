import { expect, test } from "@playwright/test";
import { ADMIN, STAFF, login, loginAs } from "./helpers";

test("ผู้ไม่ล็อกอินถูกส่งไป /login", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/admin/courses");
  await expect(page).toHaveURL(/\/login/);
});

test("รหัสผ่านผิดและอีเมลที่ไม่มี ได้ข้อความเดียวกัน", async ({ page }) => {
  for (const [email, password] of [
    [ADMIN, "wrong-password"],
    ["nobody@test.local", "password-1234"],
  ]) {
    await login(page, email, password);
    await expect(page.getByText("อีเมลหรือรหัสผ่านไม่ถูกต้อง")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  }
});

test("STAFF ล็อกอินได้ ไม่เห็นเมนูผู้ใช้ แล้วออกจากระบบ", async ({ page }) => {
  await loginAs(page, STAFF);
  await expect(page.getByRole("heading", { name: "ภาพรวม" })).toBeVisible();
  await expect(page.getByRole("link", { name: "ผู้ใช้", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "ออกจากระบบ" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login/);
});

test("ADMIN เห็นเมนูผู้ใช้ และอีเมลไม่สนตัวพิมพ์", async ({ page }) => {
  await loginAs(page, "Admin@Test.Local");
  await expect(page.getByRole("link", { name: "ผู้ใช้", exact: true })).toBeVisible();
});
