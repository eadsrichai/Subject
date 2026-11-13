import ExcelJS from "exceljs";
import { expect, test } from "vitest";
import type { CourseListItem } from "@/lib/courses";
import { coursesToXlsx } from "@/lib/export";

const item = (over: Partial<CourseListItem>): CourseListItem => ({
  id: 1,
  code: "31900-0001",
  nameTh: "การสร้างเว็บไซต์",
  nameEn: "Website Development",
  theoryHours: 1,
  practiceHours: 4,
  credits: 3,
  categoryName: "กลุ่มสมรรถนะวิชาชีพพื้นฐาน",
  needsReview: false,
  programs: [],
  ...over,
});

async function read(buf: Buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  return wb.getWorksheet("รายวิชา")!;
}

test("หัวตารางและแถวข้อมูล", async () => {
  const ws = await read(await coursesToXlsx([item({})]));
  expect(ws.getRow(1).values).toEqual([
    undefined,
    "รหัสวิชา",
    "ชื่อวิชา (ไทย)",
    "ชื่อวิชา (อังกฤษ)",
    "ทฤษฎี",
    "ปฏิบัติ",
    "หน่วยกิต",
    "หมวด/กลุ่มวิชา",
  ]);
  expect(ws.getRow(2).values).toEqual([
    undefined,
    "31900-0001",
    "การสร้างเว็บไซต์",
    "Website Development",
    1,
    4,
    3,
    "กลุ่มสมรรถนะวิชาชีพพื้นฐาน",
  ]);
  expect(ws.getRow(1).font?.bold).toBe(true);
});

test("ผลลัพธ์ว่างยังได้ไฟล์ที่มีหัวตาราง", async () =>
  expect((await read(await coursesToXlsx([]))).rowCount).toBe(1));

test("ค่าที่ขึ้นต้นด้วย = ถูกเก็บเป็นข้อความ ไม่ใช่สูตร", async () => {
  const ws = await read(await coursesToXlsx([item({ nameTh: "=1+1" })]));
  expect(ws.getCell("B2").type).toBe(ExcelJS.ValueType.String);
  expect(ws.getCell("B2").value).toBe("=1+1");
});

test("ทุกแถวถูกเขียน ไม่จำกัดจำนวน", async () => {
  const many = Array.from({ length: 130 }, (_, i) => item({ id: i, code: `30000-${1000 + i}` }));
  expect((await read(await coursesToXlsx(many))).rowCount).toBe(131);
});
