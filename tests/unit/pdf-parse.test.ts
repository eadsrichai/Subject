import { describe, expect, test } from "vitest";
import type { Line } from "@/scripts/pdf/lines";
import { parseCategoryHeading, parseCourseRow, parseDocument } from "@/scripts/pdf/parse";
import { fixtureLines, line as pageLine } from "../fixtures/pdf-lines";
import { pvcLines } from "../fixtures/pdf-lines-pvc";

const line = (...cells: [number, string][]): Line => pageLine(1, ...cells);

describe("parseCourseRow", () => {
  test("แถวปกติ", () =>
    expect(parseCourseRow(line([100, "31900-0001"], [171, "การสร้างเว็บไซต์"], [498, "1-4-3"]))).toEqual({
      code: "31900-0001",
      nameTh: "การสร้างเว็บไซต์",
      theoryHours: 1,
      practiceHours: 4,
      credits: 3,
    }));

  test("รหัสถูกหั่นหลาย cell", () =>
    expect(
      parseCourseRow(
        line([100, "319"], [118, "00"], [129, "-"], [133, "0"], [139, "00"], [150, "4"],
          [171, "ระบบเครือข่ายคอมพิวเตอร์"], [498, "1"], [504, "-"], [507, "4"], [513, "-"], [516, "3"]),
      ),
    ).toMatchObject({ code: "31900-0004", nameTh: "ระบบเครือข่ายคอมพิวเตอร์", credits: 3 }));

  test("ชื่อลงท้ายด้วยตัวเลขไม่ถูกกลืนเป็นชั่วโมง", () =>
    expect(
      parseCourseRow(line([95, "30000-2002"], [200, "กิจกรรมองค์การวิชาชีพ 1"], [498, "0-2"], [513, "-"], [516, "0"])),
    ).toMatchObject({ nameTh: "กิจกรรมองค์การวิชาชีพ 1", theoryHours: 0, practiceHours: 2, credits: 0 }));

  test("ชื่อที่ตัวเลขท้ายเป็น cell แยก", () =>
    expect(
      parseCourseRow(line([95, "30000-2005"], [200, "กิจกรรมในสถานประกอบการ"], [326, "1"], [498, "0-2-0"])),
    ).toMatchObject({ nameTh: "กิจกรรมในสถานประกอบการ 1", theoryHours: 0 }));

  test("cell ของชื่อคั่นด้วยช่องว่าง (cell แยกกันเฉพาะเมื่อมีช่องว่างจริงในต้นฉบับ)", () =>
    expect(parseCourseRow(line([86, "30000-1206"], [200, "ภาษาอังกฤษสำหรับ"], [284, "เทคโนโลยีธุรกิจดิจิทัล"], [498, "0-2-1"]))?.nameTh).toBe(
      "ภาษาอังกฤษสำหรับ เทคโนโลยีธุรกิจดิจิทัล",
    ));

  test("ขีดกลางแบบ en dash", () =>
    expect(
      parseCourseRow(line([100, "31900-1001"], [171, "กฎหมาย"], [495, "1"], [501, "–"], [507, "0"], [513, "-"], [516, "1"]))
        ?.credits,
    ).toBe(1));

  test("ชั่วโมงสองหลัก", () =>
    expect(parseCourseRow(line([72, "31901-2015"], [150, "โครงงาน"], [492, "0-12-4"]))).toMatchObject({
      practiceHours: 12,
      credits: 4,
    }));

  test("ไม่ใช่แถวรายวิชา", () => {
    expect(parseCourseRow(line([104, "รหัสวิชา"], [207, "ชื่อวิชา"], [495, "ท-ป-น"]))).toBeNull();
    expect(parseCourseRow(line([171, "Website Development"]))).toBeNull();
    expect(parseCourseRow(line([100, "31900-0001"], [171, "ไม่มีชั่วโมง"]))).toBeNull();
    expect(parseCourseRow(line([100, "31900-0001"], [498, "1-4-3"]))).toBeNull();
  });
});

describe("parseCategoryHeading", () => {
  test("หมวดพร้อมหน่วยกิตขั้นต่ำ", () =>
    expect(
      parseCategoryHeading(
        line([90, "1."], [108, "หมวดวิชาสมรรถนะแกนกลาง"], [396, "ไม่น้อยกว่า"], [456, "15"], [477, "หน่วยกิต"]),
      ),
    ).toEqual({ code: "1", name: "หมวดวิชาสมรรถนะแกนกลาง", minCredits: 15 }));

  test("กลุ่มที่หน่วยกิตอยู่ในวงเล็บ", () =>
    expect(
      parseCategoryHeading(line([90, "2.1"], [108, "กลุ่มสมรรถนะวิชาชีพพื้นฐาน"], [238, "(15"], [258, "หน่วยกิต"], [297, ")"])),
    ).toEqual({ code: "2.1", name: "กลุ่มสมรรถนะวิชาชีพพื้นฐาน", minCredits: 15 }));

  test("ตัวเลขหน่วยกิตถูกหั่น", () =>
    expect(
      parseCategoryHeading(
        line([90, "2."], [108, "หมวดวิชาสมรรถนะวิชาชีพ"], [396, "ไม่น้อยกว่า"], [456, "6"], [462, "0"], [477, "หน่วยกิต"]),
      ),
    ).toMatchObject({ minCredits: 60 }));

  test("ไม่มีหน่วยกิต", () =>
    expect(
      parseCategoryHeading(line([72, "4."], [90, "กิจกรรมเสริมหลักสูตร"], [201, "(2 ชั่วโมงต่อสัปดาห์)"])),
    ).toEqual({ code: "4", name: "กิจกรรมเสริมหลักสูตร", minCredits: null }));

  test("ข้อย่อยในเนื้อหาไม่ใช่หัวข้อหมวด", () => {
    expect(parseCategoryHeading(line([108, "1. เข้าใจหลักการเขียนแผนธุรกิจ"]))).toBeNull();
    expect(parseCategoryHeading(line([108, "2."], [123, "มีทักษะในการจัดการองค์การ"]))).toBeNull();
  });
});

describe("parseDocument", () => {
  const out = parseDocument(fixtureLines);
  const byCode = (code: string) => out.courses.find((c) => c.code === code)!;

  test("วิชาซ้ำนับครั้งเดียว เรียงตามรหัส", () =>
    expect(out.courses.map((c) => c.code)).toEqual(["30000-1101", "30000-1102", "31900-0001"]));

  test("ผูกหมวดจากหัวข้อล่าสุด และหมวดปรับพื้นฐานใช้รหัส PRE", () => {
    expect(byCode("30000-1101").categoryCode).toBe("1.1");
    expect(byCode("31900-0001").categoryCode).toBe("PRE");
    expect(out.categories.map((c) => c.code)).toEqual(["1", "1.1", "PRE"]);
    expect(out.categories.find((c) => c.code === "1.1")).toMatchObject({ parentCode: "1", minCredits: 6 });
    expect(out.categories.find((c) => c.code === "PRE")).toMatchObject({
      name: "รายวิชาปรับพื้นฐานวิชาชีพ",
      parentCode: null,
      minCredits: 15,
    });
  });

  test("ชื่ออังกฤษมาจากบรรทัดถัดจากแถว", () =>
    expect(byCode("30000-1101").nameEn).toBe("Thai Language Skills for Career Communication"));

  test("ชื่อไทยใช้จากตาราง ไม่ใช่จากหัวบล็อกคำอธิบายที่เพี้ยน", () =>
    expect(byCode("30000-1101").nameTh).toBe("ทักษะภาษาไทยเพื่อการสื่อสารในงานอาชีพ"));

  test("แบ่งห้าหัวข้อ เนื้อหาข้ามหน้าต่อกัน คงการขึ้นบรรทัดของเลขข้อ", () => {
    const c = byCode("30000-1101");
    expect(c.standardRef).toBe("-");
    expect(c.learningOutcome).toBe("ใช้ภาษาไทยสื่อสารในงานอาชีพ");
    expect(c.objectives).toBe("1. เข้าใจหลักการใช้ภาษาไทย\n2. มีทักษะการสื่อสารในงานอาชีพ");
    expect(c.competencies).toBe("1. ประมวลความรู้เกี่ยวกับการใช้ภาษาไทย");
    expect(c.description).toBe("ศึกษาและปฏิบัติเกี่ยวกับการใช้ภาษาไทยการฟัง การพูด Presentation ในงานอาชีพ");
    expect(c.sourcePage).toBe(61);
    expect(c.needsReview).toBe(false);
    expect(c.reviewReasons).toEqual([]);
  });

  test("หัวข้อกลุ่มที่อยู่เหนือบล็อกถัดไป และหน้าคั่นหมวด ไม่ถูกต่อท้ายคำอธิบายของวิชาก่อนหน้า", () => {
    expect(byCode("31900-0001").description).toBe(
      "ศึกษาและปฏิบัติเกี่ยวกับหลักการสร้างเว็บไซต์ (Upload) เผยแพร่ใช้ในงานอาชีพ",
    );
    expect(byCode("30000-1101").description).not.toContain("หมวดวิชา");
  });

  test("วิชาที่ไม่มีคำอธิบายถูกตั้ง needsReview พร้อมเหตุผล", () =>
    expect(byCode("30000-1102")).toMatchObject({
      needsReview: true,
      reviewReasons: ["ไม่พบคำอธิบายรายวิชา"],
      description: null,
      sourcePage: null,
    }));

  test("หมวดที่ทั้งหมวดไม่มีคำอธิบายในเล่ม (อยู่ในเอกสารนอกเล่ม) ไม่ถูกตั้ง needsReview", () => {
    const r = parseDocument([
      pageLine(38, [72, "1."], [90, "หมวดวิชาสมรรถนะแกนกลาง"]),
      pageLine(38, [90, "1.1"], [108, "กลุ่มสมรรถนะภาษาและการสื่อสาร"]),
      pageLine(38, [86, "30000-1101"], [200, "ทักษะภาษาไทย"], [498, "1-2-2"]),
      pageLine(42, [90, "1.2"], [108, "กลุ่มสมรรถนะการคิดและการแก้ปัญหา"]),
      pageLine(42, [86, "30000-1301"], [200, "วิทยาศาสตร์"], [498, "1-2-2"]),
    ]);
    expect(r.courses.map((c) => [c.needsReview, c.reviewReasons])).toEqual([
      [false, []],
      [false, []],
    ]);
  });

  test("รหัสในบล็อกคำอธิบายพิมพ์ผิด แต่ชื่อตรงกับวิชาในตารางที่ยังไม่มีคำอธิบาย → รวมเป็นวิชาเดียว", () => {
    const r = parseDocument([
      pageLine(45, [90, "2.2"], [108, "กลุ่มสมรรถนะวิชาชีพเฉพาะ"]),
      pageLine(45, [100, "31901-2008"], [171, "การพัฒนาซอฟต์แวร์รูปแบบเดฟออฟส์ (DevOps)"], [498, "1-4-3"]),
      pageLine(80, [72, "30901-2008"], [143, "กำรพัฒนำซอฟต์แวร์รูปแบบเดฟออฟส์ (DevOps)"], [493, "1-4-3"]),
      pageLine(80, [72, "อ้ำงอิงมำตรฐำน"]),
      pageLine(80, [108, "-"]),
      pageLine(80, [72, "ผลลัพธ์กำรเรียนรู้ระดับรำยวิชำ"]),
      pageLine(80, [108, "ก"]),
      pageLine(80, [72, "จุดประสงค์รำยวิชำ"]),
      pageLine(80, [108, "ข"]),
      pageLine(80, [72, "สมรรถนะรำยวิชำ"]),
      pageLine(80, [108, "ค"]),
      pageLine(80, [72, "คำอธิบำยรำยวิชำ"]),
      pageLine(80, [108, "ศึกษา"]),
    ]);
    expect(r.courses).toHaveLength(1);
    expect(r.courses[0]).toMatchObject({
      code: "31901-2008",
      nameTh: "การพัฒนาซอฟต์แวร์รูปแบบเดฟออฟส์ (DevOps)",
      description: "ศึกษา",
      sourcePage: 80,
      needsReview: true,
      reviewReasons: ["รหัสวิชาในคำอธิบาย (30901-2008) ไม่ตรงกับตาราง"],
    });
  });

  test("ท-ป-น สองแหล่งไม่ตรงกัน, ขาดหัวข้อ, และวิชาที่มีแต่คำอธิบาย", () => {
    const r = parseDocument([
      pageLine(38, [90, "3."], [108, "หมวดวิชาเลือกเสรี"]),
      pageLine(38, [100, "31900-0002"], [171, "การเขียนโปรแกรม"], [498, "1-4-3"]),
      pageLine(50, [72, "31900-0002"], [143, "กำรเขียนโปรแกรม"], [493, "2-2-3"]),
      pageLine(50, [72, "อ้ำงอิงมำตรฐำน"]),
      pageLine(50, [108, "-"]),
      pageLine(50, [72, "คำอธิบำยรำยวิชำ"]),
      pageLine(50, [108, "ศึกษา"]),
      pageLine(51, [72, "31900-0009"], [143, "วิชำลึกลับ"], [493, "1-0-1"]),
      pageLine(51, [144, "Mystery"]),
      pageLine(51, [72, "อ้ำงอิงมำตรฐำน"]),
    ]);
    expect(r.courses[0].reviewReasons).toEqual([
      "ท-ป-น ไม่ตรงกัน (ตาราง 1-4-3, คำอธิบาย 2-2-3)",
      "ขาดหัวข้อ: ผลลัพธ์การเรียนรู้ระดับรายวิชา",
      "ขาดหัวข้อ: จุดประสงค์รายวิชา",
      "ขาดหัวข้อ: สมรรถนะรายวิชา",
    ]);
    expect(r.courses[0]).toMatchObject({ theoryHours: 1, practiceHours: 4, credits: 3 });
    expect(r.courses[1]).toMatchObject({
      code: "31900-0009",
      nameTh: "วิชำลึกลับ",
      nameEn: "Mystery",
      categoryCode: null,
      needsReview: true,
    });
    expect(r.courses[1].reviewReasons[0]).toBe("ไม่พบในตารางโครงสร้าง");
  });
});

describe("เล่ม ปวช.", () => {
  const data = parseDocument(pvcLines);
  test("หมวดเลขมีจุด ไม่มี PRE", () =>
    expect(data.categories.map((c) => c.code)).toEqual(["1", "1.1", "2", "2.1", "4"]));
  test("รหัสถูกหั่นที่ x ห่างกัน", () =>
    expect(data.courses.find((c) => c.code === "20000-2003")).toMatchObject({ nameTh: "กิจกรรมเสริมสร้างสุจริต จิตอาสา", credits: 0, categoryCode: "4" }));
  test("ข้อความแม่แบบ (เว้นระยะอักษร …) ไม่ปนในเนื้อหา", () => {
    const c = data.courses.find((c) => c.code === "21900-1001")!;
    for (const v of [c.standardRef, c.learningOutcome, c.objectives, c.competencies, c.description])
      expect(v).not.toMatch(/เว้นระยะ/);
    expect(c.reviewReasons).toEqual([]);
  });
  test("หมวดแกนกลางที่คำอธิบายอยู่นอกเล่ม ไม่ติดธง", () =>
    expect(data.courses.find((c) => c.code === "20000-1101")).toMatchObject({ description: null, needsReview: false }));
  test("ข้อความแม่แบบท้ายบรรทัดเนื้อหา และ (ให้เขียนเพียง 4 ข้อเท่านั้น) ถูกตัดออก", () => {
    expect(data.courses.find((c) => c.code === "21900-1002")).toMatchObject({ standardRef: "-", reviewReasons: [] });
    expect(data.courses.find((c) => c.code === "21900-1001")!.objectives).toBe(
      "1. รู้และเข้าใจหลักการเขียนโปรแกรมคอมพิวเตอร์",
    );
  });
});
