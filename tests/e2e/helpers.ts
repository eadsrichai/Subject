import { expect, type Page } from "@playwright/test";

export const PASSWORD = "password-1234";
export const ADMIN = "admin@test.local";
export const STAFF = "staff@test.local";

/** Submits the login form; does not assert the outcome. */
export async function login(page: Page, email: string, password: string = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("อีเมล").fill(email);
  await page.getByLabel("รหัสผ่าน").fill(password);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
}

export async function loginAs(page: Page, email: string, password: string = PASSWORD) {
  await login(page, email, password);
  await expect(page).toHaveURL(/\/admin$/);
}
