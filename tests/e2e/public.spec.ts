import { expect, test } from "@playwright/test";
import ExcelJS from "exceljs";

test("ค้นหา แล้วเปิดรายละเอียด", async ({ page }) => {
  await page.goto("/p/31901");
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
  await expect(page.getByRole("table", { name: "อยู่ในหลักสูตร" })).toContainText(
    "หมวดวิชาสมรรถนะวิชาชีพ / กลุ่มสมรรถนะวิชาชีพพื้นฐาน",
  );
});

test("ตัวกรองหมวดและหน้า 2 คงอยู่ใน URL", async ({ page }) => {
  await page.goto("/p/31901");
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
  await page.goto("/p/31901");
  await page.getByLabel("หน่วยกิต").selectOption("3");
  await expect(page).toHaveURL(/credits=3/);
  await expect(page.getByText("พบ 1 รายวิชา")).toBeVisible();
});

test("ไม่พบผลลัพธ์", async ({ page }) => {
  await page.goto("/p/31901?q=zzzzzz");
  await expect(page.getByText("ไม่พบรายวิชาที่ตรงกับเงื่อนไข")).toBeVisible();
  await page.getByRole("link", { name: "ล้างตัวกรอง" }).click();
  await expect(page).toHaveURL(/\/p\/31901$/);
  await expect(page.getByRole("row")).toHaveCount(21);
});

test("รหัสวิชาที่ไม่มีจริง → 404 ภาษาไทย", async ({ page }) => {
  const res = await page.goto("/courses/99999-9999");
  expect(res?.status()).toBe(404);
  await expect(page.getByText("ไม่พบหน้าที่ต้องการ")).toBeVisible();
});

test("query string แปลก ๆ ไม่ทำให้ล้ม", async ({ page }) => {
  const res = await page.goto("/p/31901?page=abc&category=x&credits=-1&q=%25");
  expect(res?.status()).toBe(200);
  await expect(page.getByText("ไม่พบรายวิชาที่ตรงกับเงื่อนไข")).toBeVisible();
  expect((await page.goto("/p/31901?page=9999"))?.status()).toBe(200);
  await expect(page.getByRole("row")).toHaveCount(6); // หน้าสุดท้าย: 5 แถว
});

test("หน้าพิมพ์แสดงทุกแถวตามตัวกรอง", async ({ page }) => {
  await page.goto("/p/31901/print");
  await expect(page.getByRole("row")).toHaveCount(46);
  await page.goto("/p/31901/print?q=เว็บไซต์");
  await expect(page.getByRole("row")).toHaveCount(2);
  await expect(page.getByText("คำค้น: เว็บไซต์")).toBeVisible();
});

test("ดาวน์โหลด Excel ได้ครบทุกแถวตามตัวกรอง ไม่ใช่เฉพาะหน้าแรก", async ({ page }) => {
  await page.goto("/p/31901");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "ส่งออก Excel" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^courses-31901-\d{8}\.xlsx$/);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile((await download.path())!);
  expect(wb.getWorksheet("รายวิชา")!.rowCount).toBe(46);
});

test("Excel ตามตัวกรอง และผลลัพธ์ว่างยังได้ไฟล์ที่เปิดได้", async ({ request }) => {
  const rows = async (query: string) => {
    const res = await request.get(`/api/export?program=31901&${query}`);
    expect(res.status()).toBe(200);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await res.body()) as unknown as ArrayBuffer);
    return wb.getWorksheet("รายวิชา")!.rowCount;
  };
  expect(await rows("credits=3")).toBe(2);
  expect(await rows("q=zzzzzz")).toBe(1);
  expect(await rows("page=3")).toBe(46);
});

test("หน้าแรกแสดงหลักสูตรแยกระดับ", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "ปวช." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "ปวส." })).toBeVisible();
  await page.getByRole("link", { name: /เทคโนโลยีสารสนเทศ.*31901/ }).click();
  await expect(page).toHaveURL(/\/p\/31901$/);
  await expect(page.getByText("ปวส. สาขาวิชาเทคโนโลยีสารสนเทศ")).toBeVisible();
  await expect(page).toHaveTitle("เทคโนโลยีสารสนเทศ (ปวส.) — ฐานข้อมูลรายวิชา");
});

test("หน้าสาขาแสดงเฉพาะวิชาและหมวดของสาขานั้น", async ({ page }) => {
  await page.goto("/p/21901");
  await expect(page.getByText("พบ 2 รายวิชา")).toBeVisible();
  await expect(page.getByLabel("หมวดวิชา").locator("option")).toHaveCount(3); // ทุกหมวด + 2
  await page.getByRole("link", { name: "21900-1001" }).click();
  await expect(page).toHaveURL(/\/courses\/21900-1001\?from=21901$/);
});

test("ค้นหาข้ามสาขาเห็นป้ายทั้งสองสาขา", async ({ page }) => {
  await page.goto("/search?q=30000-1101");
  const row = page.getByRole("row", { name: /30000-1101/ });
  await expect(row.getByText("ปวช. เทคโนโลยีสารสนเทศ")).toBeVisible();
  await expect(row.getByText("ปวส. เทคโนโลยีสารสนเทศ")).toBeVisible();
});

test("ค้นหาข้ามสาขาจากหน้าแรก", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("ค้นหา").fill("21900-1001");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/search\?q=21900-1001/);
  await expect(page.getByText("พบ 1 รายวิชา")).toBeVisible();
});

test("รายละเอียดวิชาแสดงทุกสาขา และลิงก์กลับเมื่อมี from", async ({ page }) => {
  await page.goto("/courses/30000-1101?from=21901");
  const table = page.getByRole("table", { name: "อยู่ในหลักสูตร" });
  await expect(table.getByRole("row")).toHaveCount(3); // หัวตาราง + 2
  await expect(table).toContainText("กลุ่มสมรรถนะภาษาและการสื่อสาร");
  await page.getByRole("link", { name: /กลับไปหน้ารายวิชา/ }).click();
  await expect(page).toHaveURL(/\/p\/21901$/);
});

test("วิชาไร้สาขา: เจอใน /search ไม่เจอในหน้าสาขา", async ({ page }) => {
  await page.goto("/search?q=99999");
  await expect(page.getByRole("row")).toHaveCount(2);
  await page.goto("/courses/99999-0001");
  await expect(page.getByText("ยังไม่อยู่ในหลักสูตรใด")).toBeVisible();
  await page.goto("/p/31901?q=99999");
  await expect(page.getByText("ไม่พบรายวิชาที่ตรงกับเงื่อนไข")).toBeVisible();
});

for (const path of ["/p/abc", "/p/3190", "/p/99999", "/p/99999/dashboard", "/p/99999/print", "/dashboard", "/print"]) {
  test(`${path} → 404 ภาษาไทย`, async ({ page }) => {
    const res = await page.goto(path);
    expect(res?.status()).toBe(404);
    await expect(page.getByText("ไม่พบหน้าที่ต้องการ")).toBeVisible();
  });
}

test("export ไม่มี program หรือรหัสไม่มีจริง → 404", async ({ request }) => {
  expect((await request.get("/api/export")).status()).toBe(404);
  expect((await request.get("/api/export?program=99999")).status()).toBe(404);
  expect((await request.get("/api/export?program=abc")).status()).toBe(404);
});
