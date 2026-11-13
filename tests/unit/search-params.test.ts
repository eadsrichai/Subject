import { expect, test } from "vitest";
import { filterToQuery, parseFilter } from "@/lib/course-filter";

test("ค่าเริ่มต้น", () =>
  expect(parseFilter({})).toEqual({ programId: null, q: "", categoryId: null, credits: null, page: 1 }));

test("q ถูก normalize และ trim; ช่องว่างล้วนเป็นค่าว่าง", () => {
  expect(parseFilter({ q: "  คําสั่ง " }).q).toBe("คำสั่ง");
  expect(parseFilter({ q: "   " }).q).toBe("");
});

test("q ยาวเกิน 100 ตัวถูกตัด", () =>
  expect(parseFilter({ q: "ก".repeat(300) }).q).toHaveLength(100));

test.each([
  ["abc", 1],
  ["-3", 1],
  ["0", 1],
  ["2.7", 1],
  ["", 1],
  ["3", 3],
  ["99999999999999999999", 1],
])("page=%s → %i", (v, want) => expect(parseFilter({ page: v }).page).toBe(want));

test("category/credits ที่ไม่ใช่จำนวนเต็มไม่ติดลบถูกเพิกเฉย", () => {
  expect(parseFilter({ category: "x", credits: "-1" })).toMatchObject({ categoryId: null, credits: null });
  expect(parseFilter({ category: "1e3", credits: "2.5" })).toMatchObject({ categoryId: null, credits: null });
  expect(parseFilter({ category: "12", credits: "0" })).toMatchObject({ categoryId: 12, credits: 0 });
});

test("ค่าเป็น array ใช้ตัวแรก", () => expect(parseFilter({ q: ["a", "b"] }).q).toBe("a"));

test("filterToQuery ละค่า default", () => {
  expect(filterToQuery({ q: "", page: 1 })).toBe("");
  expect(filterToQuery({ q: "เว็บ", categoryId: 3, page: 2 })).toBe(
    "?q=%E0%B9%80%E0%B8%A7%E0%B9%87%E0%B8%9A&category=3&page=2",
  );
  expect(filterToQuery({ credits: 0 })).toBe("?credits=0");
});

test("parseFilter กับ filterToQuery ไปกลับได้", () => {
  const f = { programId: null, q: "a b&c", categoryId: 7, credits: 3, page: 4 };
  const sp = Object.fromEntries(new URLSearchParams(filterToQuery(f).slice(1)));
  expect(parseFilter(sp)).toEqual(f);
});
