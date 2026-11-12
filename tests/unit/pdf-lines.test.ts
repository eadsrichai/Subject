import { expect, test } from "vitest";
import { buildLines } from "@/scripts/pdf/lines";

test("รวม item ที่ baseline ต่างกันไม่เกิน 4pt เป็นบรรทัดเดียว เรียงตาม x", () => {
  const lines = buildLines(94, [
    { str: "กิจกรรมองค์การวิชาชีพ 1", x: 200, y: 528, width: 120 },
    { str: "30000", x: 95, y: 525, width: 28 },
    { str: "-", x: 123, y: 525, width: 4 },
    { str: "20", x: 127, y: 525, width: 12 },
    { str: "02", x: 139, y: 525, width: 11 },
    { str: " ", x: 150, y: 525, width: 348 },
    { str: "0", x: 498, y: 525, width: 6 },
    { str: "-", x: 504, y: 525, width: 3 },
    { str: "2", x: 507, y: 525, width: 6 },
    { str: "-", x: 513, y: 525, width: 3 },
    { str: "0", x: 516, y: 525, width: 5 },
  ]);
  expect(lines).toHaveLength(1);
  expect(lines[0].page).toBe(94);
  expect(lines[0].cells.map((c) => c.text)).toEqual([
    "30000-2002",
    "กิจกรรมองค์การวิชาชีพ 1",
    "0-2-0",
  ]);
  expect(lines[0].cells.map((c) => c.x)).toEqual([95, 200, 498]);
});

test("item ที่ห่างกันน้อยกว่า 2pt ต่อกันไม่เว้นวรรค ห่างกว่านั้นเป็น cell ใหม่", () => {
  const [l] = buildLines(1, [
    { str: "I", x: 151, y: 700, width: 3 },
    { str: "nformation technology", x: 154, y: 700, width: 118 },
    { str: " ", x: 272, y: 700, width: 4 },
    { str: "Projects", x: 276, y: 700, width: 40 },
  ]);
  expect(l.cells.map((c) => c.text)).toEqual(["Information technology", "Projects"]);
  expect(l.text).toBe("Information technology Projects");
});

test("ตัดหัวกระดาษ (y > 780) ท้ายกระดาษ (y < 80) และ item ว่าง", () => {
  const lines = buildLines(1, [
    { str: "47", x: 513, y: 786, width: 10 },
    { str: " ", x: 100, y: 500, width: 3 },
    { str: "", x: 72, y: 500, width: 0 },
    { str: "หลักสูตร…", x: 113, y: 66, width: 300 },
    { str: "เนื้อหา", x: 72, y: 500, width: 40 },
  ]);
  expect(lines.map((l) => l.text)).toEqual(["เนื้อหา"]);
});

test("บรรทัดเรียงจากบนลงล่าง และข้อความใน cell ถูก normalize", () => {
  const lines = buildLines(1, [
    { str: "ล่าง", x: 72, y: 400, width: 20 },
    { str: "กลุม", x: 72, y: 600, width: 20 },
  ]);
  expect(lines.map((l) => l.text)).toEqual(["กลุ่ม", "ล่าง"]);
});
