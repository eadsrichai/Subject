import { expect, test } from "@playwright/test";

test("แดชบอร์ดแสดงตัวเลขตรงกับข้อมูล", async ({ page }) => {
  await page.goto("/p/31901/dashboard");
  await expect(page.getByTestId("total-courses")).toHaveText("45");

  const structure = page.getByRole("table", { name: "โครงสร้างหลักสูตร" });
  await expect(structure.getByRole("row", { name: /^1 หมวดวิชาสมรรถนะแกนกลาง/ })).toContainText("15");
  const group = structure.getByRole("row", { name: /^1\.1 กลุ่มสมรรถนะภาษาและการสื่อสาร/ });
  await expect(group.getByRole("cell").nth(2)).toHaveText("6"); // หน่วยกิตขั้นต่ำ
  await expect(group.getByRole("cell").nth(3)).toHaveText("30"); // จำนวนวิชา
  await expect(group.getByRole("cell").nth(4)).toHaveText("60"); // หน่วยกิตรวม

  await expect(page.locator(".recharts-wrapper")).toHaveCount(3);
});
