import { expect, test } from "vitest";
import { foldThai, normalizeThai } from "@/lib/normalize-thai";

test.each([
  ["ใช", "ใช้"], // PUA วรรณยุกต์ตำแหน่งต่ำ
  ["กลุม", "กลุ่ม"],
  ["ซอฟตแวร", "ซอฟต์แวร์"],
  ["เปน", "เป็น"],
  ["คําสั่ง", "คำสั่ง"], // นิคหิต + สระอา → สระอำ
  ["ค ำนำ", "คำนำ"], // ช่องว่างก่อนสระอำ
])("%s → %s", (input, want) => expect(normalizeThai(input)).toBe(want));

// สระอำที่หายจนเหลือ "ช่องว่าง + า" เดาคืนไม่ได้ ต้องคงไว้ตามเดิมให้คนแก้
test("ไม่เดาสระอำที่หายไป", () => expect(normalizeThai("ส านักงาน")).toBe("ส านักงาน"));

test("ลบสัญลักษณ์ PUA ของฟอนต์สัญลักษณ์", () =>
  expect(normalizeThai(" หลักการ")).toBe("หลักการ"));
test("ยุบช่องว่างซ้ำและตัดหัวท้าย", () => expect(normalizeThai("  ก   ข ")).toBe("ก ข"));
test("ช่องว่างก่อนสระ/วรรณยุกต์บนล่างถูกลบ", () =>
  expect(normalizeThai("กลุ ่มวิชา ชั ้นสูง")).toBe("กลุ่มวิชา ชั้นสูง"));
// ช่องว่างหลังวรรณยุกต์อาจเป็นการเว้นวรรคจริง ("ได้ การ…") จึงไม่ลบ
test("ช่องว่างหลังวรรณยุกต์คงไว้", () =>
  expect(normalizeThai("ประกอบธุรกิจได้ การผลิต")).toBe("ประกอบธุรกิจได้ การผลิต"));
test("ไม่แตะข้อความอังกฤษและตัวเลข", () =>
  expect(normalizeThai("Website Development 1-4-3")).toBe("Website Development 1-4-3"));
test("foldThai", () => expect(foldThai("ค ำอธิบำยรำยวิชำ")).toBe("คาอธิบายรายวิชา"));
