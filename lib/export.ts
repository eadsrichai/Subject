import ExcelJS from "exceljs";
import type { CourseListItem } from "./courses";

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** One worksheet "รายวิชา": a frozen bold header row, then one row per course. */
export async function coursesToXlsx(items: CourseListItem[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("รายวิชา", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = [
    { header: "รหัสวิชา", key: "code", width: 14 },
    { header: "ชื่อวิชา (ไทย)", key: "nameTh", width: 48 },
    { header: "ชื่อวิชา (อังกฤษ)", key: "nameEn", width: 48 },
    { header: "ทฤษฎี", key: "theoryHours", width: 9 },
    { header: "ปฏิบัติ", key: "practiceHours", width: 9 },
    { header: "หน่วยกิต", key: "credits", width: 9 },
    { header: "หมวด/กลุ่มวิชา", key: "categoryName", width: 40 },
  ];
  ws.getRow(1).font = { bold: true };
  // Values are written as plain cell values, so text starting with "=" stays text.
  for (const c of items) ws.addRow(c);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
