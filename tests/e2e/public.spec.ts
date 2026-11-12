import { expect, test } from "@playwright/test";
import ExcelJS from "exceljs";

test("ค้นหา แล้วเปิดรายละเอียด", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("row")).toHaveCount(21); // หัวตาราง + 20
  await expect(page.getByText("พบ 45 รายวิชา")).toBeVisible();

  await page.getByLabel("ค้นหา").fill("เว็บไซต์");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/q=/);
  await expect(page.getByText("พบ 1 รายวิชา")).toBeVisible();

  await page.getByRole("link", { name: "31900-0001" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("การสร้างเว็บไซต์");
  await expect(page.getByText("Website Development")).toBeVisible();
  await expect(page.getByText("ทฤษฎี 1 ชม. ปฏิบัติ 4 ชม. 3 หน่วยกิต")).toBeVisible();
  for (const h of [
    "อ้างอิงมาตรฐาน",
    "ผลลัพธ์การเรียนรู้ระดับรายวิชา",
    "จุดประสงค์รายวิชา",
    "สมรรถนะรายวิชา",
    "คำอธิบายรายวิชา",
  ]) {
    await expect(page.getByRole("heading", { name: h, exact: true })).toBeVisible();
  }
  await expect(page.getByText("2. มีทักษะในการสร้างเว็บไซต์")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "เส้นทางหมวดวิชา" })).toContainText(
    "กลุ่มสมรรถนะวิชาชีพพื้นฐาน",
  );
});

test("ตัวกรองหมวดและหน้า 2 คงอยู่ใน URL", async ({ page }) => {
  await page.goto("/");
  const select = page.getByLabel("หมวดวิชา");
  const value = await select.locator("option", { hasText: "1.1" }).getAttribute("value");
  await select.selectOption(value!);
  await expect(page).toHaveURL(/category=\d+/);
  await expect(page.getByText("พบ 30 รายวิชา")).toBeVisible();

  await page.getByRole("link", { name: "ถัดไป" }).click();
  await expect(page).toHaveURL(/category=\d+&page=2/);
  await expect(page.getByRole("row")).toHaveCount(11);
  await expect(select).toHaveValue(value!);
});

test("กรองตามหน่วยกิต", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("หน่วยกิต").selectOption("3");
  await expect(page).toHaveURL(/credits=3/);
  await expect(page.getByText("พบ 1 รายวิชา")).toBeVisible();
});

test("ไม่พบผลลัพธ์", async ({ page }) => {
  await page.goto("/?q=zzzzzz");
  await expect(page.getByText("ไม่พบรายวิชาที่ตรงกับเงื่อนไข")).toBeVisible();
  await page.getByRole("link", { name: "ล้างตัวกรอง" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("row")).toHaveCount(21);
});

test("รหัสวิชาที่ไม่มีจริง → 404 ภาษาไทย", async ({ page }) => {
  const res = await page.goto("/courses/99999-9999");
  expect(res?.status()).toBe(404);
  await expect(page.getByText("ไม่พบหน้าที่ต้องการ")).toBeVisible();
});

test("query string แปลก ๆ ไม่ทำให้ล้ม", async ({ page }) => {
  const res = await page.goto("/?page=abc&category=x&credits=-1&q=%25");
  expect(res?.status()).toBe(200);
  await expect(page.getByText("ไม่พบรายวิชาที่ตรงกับเงื่อนไข")).toBeVisible();
  expect((await page.goto("/?page=9999"))?.status()).toBe(200);
  await expect(page.getByRole("row")).toHaveCount(6); // หน้าสุดท้าย: 5 แถว
});

test("หน้าพิมพ์แสดงทุกแถวตามตัวกรอง", async ({ page }) => {
  await page.goto("/print");
  await expect(page.getByRole("row")).toHaveCount(46);
  await page.goto("/print?q=เว็บไซต์");
  await expect(page.getByRole("row")).toHaveCount(2);
  await expect(page.getByText("คำค้น: เว็บไซต์")).toBeVisible();
});

test("ดาวน์โหลด Excel ได้ครบทุกแถวตามตัวกรอง ไม่ใช่เฉพาะหน้าแรก", async ({ page }) => {
  await page.goto("/");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "ส่งออก Excel" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^courses-\d{8}\.xlsx$/);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile((await download.path())!);
  expect(wb.getWorksheet("รายวิชา")!.rowCount).toBe(46);
});

test("Excel ตามตัวกรอง และผลลัพธ์ว่างยังได้ไฟล์ที่เปิดได้", async ({ request }) => {
  const rows = async (query: string) => {
    const res = await request.get(`/api/export${query}`);
    expect(res.status()).toBe(200);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await res.body()) as unknown as ArrayBuffer);
    return wb.getWorksheet("รายวิชา")!.rowCount;
  };
  expect(await rows("?credits=3")).toBe(2);
  expect(await rows("?q=zzzzzz")).toBe(1);
  expect(await rows("?page=3")).toBe(46);
});
