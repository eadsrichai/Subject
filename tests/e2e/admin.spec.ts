import { expect, test, type Page } from "@playwright/test";
import { ADMIN, PASSWORD, STAFF, login, loginAs } from "./helpers";

async function selectCategory(page: Page, row: number, code: string) {
  const select = page.getByLabel(`หมวด/กลุ่มวิชา (แถว ${row})`);
  const option = select.locator("option").filter({ hasText: new RegExp(`^\\s*${code.replace(".", "\\.")} `) });
  await select.selectOption((await option.getAttribute("value"))!);
}

async function openCourseForm(page: Page, code: string) {
  await page.goto(`/admin/courses?q=${code}`);
  await page.getByRole("link", { name: code }).click();
  await expect(page.getByLabel("รหัสวิชา")).toHaveValue(code);
}

async function fillNewCourse(page: Page, code: string, name: string) {
  await page.goto("/admin/courses/new");
  await page.getByLabel("รหัสวิชา").fill(code);
  await page.getByLabel("ชื่อวิชา (ไทย)").fill(name);
  await page.getByLabel("ทฤษฎี (ชม.)").fill("1");
  await page.getByLabel("ปฏิบัติ (ชม.)").fill("2");
  await page.getByLabel("หน่วยกิต").fill("2");
  await page.getByLabel("สาขา (แถว 1)").selectOption({ label: "ปวส. เทคโนโลยีสารสนเทศ (31901)" });
  await selectCategory(page, 1, "2.1");
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

test("เพิ่มวิชาเข้าสาขาที่สอง แล้วเห็นในหน้าสาขานั้น", async ({ page }) => {
  await loginAs(page, STAFF);
  await openCourseForm(page, "31900-0001");
  await page.getByRole("button", { name: "+ เพิ่มสาขา" }).click();
  await expect(page.getByLabel("สาขา (แถว 2)")).toHaveValue(/\d+/); // สาขาที่ยังไม่ได้ใช้ถูกเลือกให้
  await page.getByLabel("สาขา (แถว 2)").selectOption({ label: "ปวช. เทคโนโลยีสารสนเทศ (21901)" });
  await selectCategory(page, 2, "2");
  await page.getByRole("button", { name: "บันทึก" }).click();
  await expect(page).toHaveURL(/\/admin\/courses$/);

  await page.goto("/p/21901?q=31900-0001");
  await expect(page.getByRole("link", { name: "31900-0001" })).toBeVisible();

  // คืนค่าเดิม เพื่อไม่ให้กระทบเทสต์หน้าสาธารณะ
  await openCourseForm(page, "31900-0001");
  await expect(page.getByText("เนื้อหาวิชานี้ใช้ร่วมกับ 2 สาขา แก้แล้วมีผลทุกสาขา")).toBeVisible();
  await page.getByRole("button", { name: "ลบแถวสาขา 2" }).click();
  await page.getByRole("button", { name: "บันทึก" }).click();
  await expect(page).toHaveURL(/\/admin\/courses$/);
  await page.goto("/p/21901?q=31900-0001");
  await expect(page.getByText("ไม่พบรายวิชาที่ตรงกับเงื่อนไข")).toBeVisible();
});

test("เลือกสาขาซ้ำเห็นข้อความรายแถว และแถวที่กรอกไม่หาย", async ({ page }) => {
  await loginAs(page, STAFF);
  await openCourseForm(page, "31900-1003");
  await page.getByRole("button", { name: "+ เพิ่มสาขา" }).click();
  await page.getByLabel("สาขา (แถว 2)").selectOption({ label: "ปวส. เทคโนโลยีสารสนเทศ (31901)" });
  await selectCategory(page, 2, "1.1");
  await page.getByRole("button", { name: "บันทึก" }).click();
  await expect(page.getByText("เลือกสาขานี้ซ้ำ")).toBeVisible();
  await expect(page.getByLabel("หมวด/กลุ่มวิชา (แถว 2)")).toHaveValue(/\d+/);
});

test("ฟอร์มวิชาที่ใช้ร่วมแสดงคำเตือน", async ({ page }) => {
  await loginAs(page, STAFF);
  await openCourseForm(page, "30000-1101");
  await expect(page.getByText("เนื้อหาวิชานี้ใช้ร่วมกับ 2 สาขา แก้แล้วมีผลทุกสาขา")).toBeVisible();
});

test("ลบแถวสาขาจนหมดแสดงคำเตือน", async ({ page }) => {
  await loginAs(page, STAFF);
  await openCourseForm(page, "31900-1004");
  await expect(page.getByText("วิชานี้จะไม่แสดงในหน้ารายวิชาของสาขาใด")).toHaveCount(0);
  await page.getByRole("button", { name: "ลบแถวสาขา 1" }).click();
  await expect(page.getByText("วิชานี้จะไม่แสดงในหน้ารายวิชาของสาขาใด")).toBeVisible();
});

test("ตัวกรองสาขาในหน้าจัดการรายวิชา", async ({ page }) => {
  await loginAs(page, STAFF);
  await page.goto("/admin/courses");
  await page.getByLabel("สาขา", { exact: true }).selectOption({ label: "ปวช. เทคโนโลยีสารสนเทศ (21901)" });
  await expect(page).toHaveURL(/program=21901/);
  await expect(page.getByText("พบ 2 รายวิชา")).toBeVisible();
  await expect(page.getByRole("row", { name: /30000-1101/ }).getByText("ปวส. เทคโนโลยีสารสนเทศ")).toBeVisible();
});

test("หน้าสาขา: เพิ่ม แก้ และลบสาขาว่างได้ ลบสาขาที่มีวิชาไม่ได้", async ({ page }) => {
  await loginAs(page, STAFF);
  await page.goto("/admin/programs");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("row", { name: /21901/ }).getByRole("button", { name: "ลบ" }).click();
  await expect(page.getByText("ลบไม่ได้: ยังมี 2 วิชาในสาขานี้")).toBeVisible();

  await page.getByLabel("รหัสสาขา").fill("123");
  await page.getByLabel("ระดับ").selectOption("PVC");
  await page.getByLabel("ชื่อสาขา").fill("สาขาทดลอง");
  await page.getByLabel("ประเภทวิชา").fill("ประเภททดลอง");
  await page.getByRole("button", { name: "เพิ่มสาขา" }).click();
  await expect(page.getByText("รหัสสาขาต้องเป็นตัวเลข 5 หลัก")).toBeVisible();
  await page.getByLabel("รหัสสาขา").fill("12345");
  await page.getByRole("button", { name: "เพิ่มสาขา" }).click();
  const row = page.getByRole("row", { name: /12345 สาขาทดลอง/ });
  await expect(row).toBeVisible();

  await row.getByRole("link", { name: "แก้ไข" }).click();
  await expect(page.getByRole("heading", { name: "แก้ไขสาขา 12345" })).toBeVisible();
  await expect(page.getByLabel("รหัสสาขา")).toHaveCount(0); // รหัสแก้ไม่ได้
  await page.getByLabel("ชื่อสาขา").fill("สาขาเปลี่ยนชื่อ");
  await page.getByRole("button", { name: "บันทึก" }).click();
  const renamed = page.getByRole("row", { name: /12345 สาขาเปลี่ยนชื่อ/ });
  await expect(renamed).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("link", { name: /สาขาเปลี่ยนชื่อ.*12345/ })).toBeVisible();

  await page.goto("/admin/programs");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("row", { name: /12345/ }).getByRole("button", { name: "ลบ" }).click();
  await expect(page.getByRole("row", { name: /12345/ })).toHaveCount(0);
});

test("หมวดแยกตามสาขา", async ({ page }) => {
  await loginAs(page, STAFF);
  await page.goto("/admin/categories?program=21901");
  await expect(page.getByRole("row", { name: /^1 หมวดวิชาสมรรถนะแกนกลาง/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /^2 หมวดวิชาสมรรถนะวิชาชีพ/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /^2\.1 / })).toHaveCount(0);
  expect((await page.goto("/admin/categories?program=99999"))?.status()).toBe(404);
});

test("ภาพรวมผู้ดูแลแยกตามสาขา", async ({ page }) => {
  await loginAs(page, STAFF);
  await page.goto("/admin");
  const row = page.getByRole("table", { name: "แยกตามสาขา" }).getByRole("row", { name: /21901/ });
  await expect(row.getByRole("cell").nth(1)).toHaveText("2");
});
