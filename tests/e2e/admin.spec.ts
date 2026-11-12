import { expect, test, type Page } from "@playwright/test";
import { ADMIN, PASSWORD, STAFF, login, loginAs } from "./helpers";

async function fillNewCourse(page: Page, code: string, name: string) {
  await page.goto("/admin/courses/new");
  await page.getByLabel("รหัสวิชา").fill(code);
  await page.getByLabel("ชื่อวิชา (ไทย)").fill(name);
  await page.getByLabel("ทฤษฎี (ชม.)").fill("1");
  await page.getByLabel("ปฏิบัติ (ชม.)").fill("2");
  await page.getByLabel("หน่วยกิต").fill("2");
  const select = page.getByLabel("หมวด/กลุ่มวิชา");
  await select.selectOption((await select.locator("option", { hasText: "2.1" }).getAttribute("value"))!);
  await page.getByRole("button", { name: "บันทึก" }).click();
}

test("STAFF แก้ชื่อวิชาแล้วหน้าสาธารณะเปลี่ยนตาม", async ({ page }) => {
  await loginAs(page, STAFF);
  await page.goto("/admin/courses?q=31900-1001");
  await page.getByRole("link", { name: "31900-1001" }).click();
  await expect(page.getByLabel("ชื่อวิชา (ไทย)")).toHaveValue("วิชาชีพพื้นฐาน 1");
  await page.getByLabel("ชื่อวิชา (ไทย)").fill("วิชาที่แก้แล้ว");
  await page.getByLabel("คำอธิบายรายวิชา").fill("บรรทัดหนึ่ง\nบรรทัดสอง");
  await page.getByRole("button", { name: "บันทึก" }).click();
  await expect(page).toHaveURL(/\/admin\/courses$/);

  await page.goto("/courses/31900-1001");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("วิชาที่แก้แล้ว");
  await expect(page.getByText("บรรทัดสอง")).toBeVisible();
});

test("เพิ่มวิชาด้วยรหัสซ้ำเห็นข้อความใต้ช่องรหัส และค่าที่กรอกไม่หาย", async ({ page }) => {
  await loginAs(page, STAFF);
  await fillNewCourse(page, "31900-0001", "วิชาซ้ำ");
  await expect(page.getByText("รหัสวิชานี้มีอยู่แล้ว")).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/courses\/new$/);
  await expect(page.getByLabel("ชื่อวิชา (ไทย)")).toHaveValue("วิชาซ้ำ");
  await expect(page.getByLabel("ปฏิบัติ (ชม.)")).toHaveValue("2");
});

test("ฟอร์มว่างแสดงข้อผิดพลาดภาษาไทยรายช่อง", async ({ page }) => {
  await loginAs(page, STAFF);
  await page.goto("/admin/courses/new");
  await page.getByLabel("รหัสวิชา").fill("abc");
  await page.getByRole("button", { name: "บันทึก" }).click();
  await expect(page.getByText("รหัสวิชาต้องอยู่ในรูปแบบ 00000-0000")).toBeVisible();
  await expect(page.getByText("กรุณากรอกชื่อวิชา")).toBeVisible();
  await expect(page.getByText("กรุณาเลือกหมวดวิชา")).toBeVisible();
});

test("เพิ่มวิชาใหม่แล้วลบ", async ({ page }) => {
  await loginAs(page, STAFF);
  await fillNewCourse(page, "39999-0001", "วิชาชั่วคราว");
  await expect(page).toHaveURL(/\/admin\/courses$/);
  await page.goto("/courses/39999-0001");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("วิชาชั่วคราว");

  await page.goto("/admin/courses?q=39999-0001");
  await page.getByRole("link", { name: "39999-0001" }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "ลบรายวิชา" }).click();
  await expect(page).toHaveURL(/\/admin\/courses$/);
  expect((await page.goto("/courses/39999-0001"))?.status()).toBe(404);
});

test("วิชาที่ต้องตรวจสอบแสดงในหน้า /admin และหายเมื่อยกเลิกเครื่องหมาย", async ({ page }) => {
  await loginAs(page, STAFF);
  const row = page.getByRole("row", { name: /31900-0002/ });
  await expect(row).toContainText("ขาดหัวข้อ: สมรรถนะรายวิชา");
  await row.getByRole("link", { name: "31900-0002" }).click();
  await page.getByLabel("ต้องตรวจสอบ").uncheck();
  await page.getByRole("button", { name: "บันทึก" }).click();
  await expect(page).toHaveURL(/\/admin\/courses$/);
  await page.goto("/admin");
  await expect(page.getByText("ไม่มีรายวิชาที่ต้องตรวจสอบ")).toBeVisible();
});

test("ลบหมวดที่มีรายวิชาเห็นข้อความปฏิเสธ; เพิ่ม แก้ไข และลบหมวดว่างได้", async ({ page }) => {
  await loginAs(page, STAFF);
  await page.goto("/admin/categories");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("row", { name: /^2\.1 / }).getByRole("button", { name: "ลบ" }).click();
  await expect(page.getByText("ลบไม่ได้: ยังมีรายวิชาหรือหมวดย่อยอยู่")).toBeVisible();

  await page.getByLabel("รหัสหมวด").fill("9");
  await page.getByLabel("ชื่อหมวด").fill("หมวดทดลอง");
  await page.getByRole("button", { name: "เพิ่มหมวดวิชา" }).click();
  const row = page.getByRole("row", { name: /^9 หมวดทดลอง/ });
  await expect(row).toBeVisible();

  await row.getByRole("link", { name: "แก้ไข" }).click();
  await expect(page.getByRole("heading", { name: "แก้ไขหมวด 9" })).toBeVisible();
  await page.getByLabel("ชื่อหมวด").fill("หมวดเปลี่ยนชื่อ");
  await page.getByRole("button", { name: "บันทึก" }).click();
  const renamed = page.getByRole("row", { name: /^9 หมวดเปลี่ยนชื่อ/ });
  await expect(renamed).toBeVisible();

  page.once("dialog", (d) => d.accept());
  await renamed.getByRole("button", { name: "ลบ" }).click();
  await expect(page.getByRole("row", { name: /^9 หมวด/ })).toHaveCount(0);
});

test("STAFF เข้า /admin/users ไม่ได้", async ({ page }) => {
  await loginAs(page, STAFF);
  await page.goto("/admin/users");
  await expect(page.getByText("คุณไม่มีสิทธิ์เข้าถึงหน้านี้")).toBeVisible();
  await expect(page.getByLabel("อีเมล")).toHaveCount(0);
});

test("ADMIN เพิ่มผู้ใช้ STAFF; ผู้ใช้ใหม่ล็อกอินและเปลี่ยนรหัสผ่านได้", async ({ page, browser }) => {
  await loginAs(page, ADMIN);
  await page.goto("/admin/users");
  await page.getByLabel("อีเมล").fill("newstaff@test.local");
  await page.getByLabel("ชื่อ", { exact: true }).fill("ครูใหม่");
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill("first-pass-1");
  await page.getByRole("button", { name: "เพิ่มผู้ใช้" }).click();
  await expect(page.getByRole("row", { name: /newstaff@test\.local/ })).toContainText("เจ้าหน้าที่");

  const ctx = await browser.newContext();
  const other = await ctx.newPage();
  await loginAs(other, "newstaff@test.local", "first-pass-1");
  await other.goto("/admin/account");
  await other.getByLabel("รหัสผ่านปัจจุบัน").fill("first-pass-1");
  await other.getByLabel("รหัสผ่านใหม่").fill("second-pass-2");
  await other.getByRole("button", { name: "เปลี่ยนรหัสผ่าน" }).click();
  await expect(other.getByText("เปลี่ยนรหัสผ่านแล้ว")).toBeVisible();
  await other.getByRole("button", { name: "ออกจากระบบ" }).click();
  await login(other, "newstaff@test.local", "first-pass-1");
  await expect(other.getByText("อีเมลหรือรหัสผ่านไม่ถูกต้อง")).toBeVisible();
  await loginAs(other, "newstaff@test.local", "second-pass-2");
  await ctx.close();
});

test("ADMIN ปิดการใช้งานผู้ใช้ที่ยังล็อกอินอยู่ → การบันทึกครั้งถัดไปของผู้ใช้นั้นถูกส่งไป /login", async ({ page, browser }) => {
  await loginAs(page, ADMIN);
  await page.goto("/admin/users");
  await page.getByLabel("อีเมล").fill("leaver@test.local");
  await page.getByLabel("ชื่อ", { exact: true }).fill("คนที่จะถูกปิด");
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "เพิ่มผู้ใช้" }).click();
  const row = page.getByRole("row", { name: /leaver@test\.local/ });
  await expect(row).toBeVisible();

  const ctx = await browser.newContext();
  const other = await ctx.newPage();
  await loginAs(other, "leaver@test.local");
  await other.goto("/admin/courses?q=31900-1002");
  await other.getByRole("link", { name: "31900-1002" }).click();
  await other.getByLabel("ชื่อวิชา (ไทย)").fill("ไม่ควรถูกบันทึก");

  await row.getByRole("link", { name: "แก้ไข" }).click();
  await expect(page.getByRole("heading", { name: /แก้ไขผู้ใช้/ })).toBeVisible();
  await page.getByLabel("เปิดใช้งาน").uncheck();
  await page.getByRole("button", { name: "บันทึก" }).click();
  await expect(page.getByRole("row", { name: /leaver@test\.local/ })).toContainText("ปิดการใช้งาน");

  await other.getByRole("button", { name: "บันทึก" }).click();
  await expect(other).toHaveURL(/\/login/);
  await ctx.close();

  await page.goto("/courses/31900-1002");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("วิชาชีพพื้นฐาน 2");
  await login(page, "leaver@test.local");
  await expect(page.getByText("อีเมลหรือรหัสผ่านไม่ถูกต้อง")).toBeVisible();
});

test("ADMIN ปิดการใช้งานตนเองไม่ได้", async ({ page }) => {
  await loginAs(page, ADMIN);
  await page.goto("/admin/users");
  await page.getByRole("row", { name: /admin@test\.local/ }).getByRole("link", { name: "แก้ไข" }).click();
  await page.getByLabel("เปิดใช้งาน").uncheck();
  await page.getByRole("button", { name: "บันทึก" }).click();
  await expect(page.getByText("ไม่สามารถเปลี่ยนบทบาทหรือปิดการใช้งานบัญชีของตนเองได้")).toBeVisible();
});
