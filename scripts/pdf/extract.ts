// One-off import: curriculum PDF → Data/extracted/courses.json + report.txt
// Usage: npm run extract
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { buildLines, type Item, type Line } from "./lines";
import { parseDocument } from "./parse";

const PDF_PATH = "Data/31901v7_18_10_68.pdf";
const OUT_DIR = "Data/extracted";
const FIRST_PAGE = 37; // curriculum structure starts here
const LAST_PAGE = 106; // scanned appendix follows

async function main() {
  const pdfjsRoot = path.resolve("node_modules/pdfjs-dist");
  const assetUrl = (dir: string) => pathToFileURL(path.join(pdfjsRoot, dir)).href + "/";
  const doc = await getDocument({
    data: new Uint8Array(fs.readFileSync(PDF_PATH)),
    cMapUrl: assetUrl("cmaps"),
    cMapPacked: true,
    standardFontDataUrl: assetUrl("standard_fonts"),
    verbosity: 0,
  }).promise;

  const lines: Line[] = [];
  for (let p = FIRST_PAGE; p <= Math.min(LAST_PAGE, doc.numPages); p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items: Item[] = [];
    for (const it of content.items) {
      if ("str" in it) items.push({ str: it.str, x: it.transform[4], y: it.transform[5], width: it.width });
    }
    lines.push(...buildLines(p, items));
  }

  const data = parseDocument(lines);
  const flagged = data.courses.filter((c) => c.needsReview);
  const report = [
    `แหล่งข้อมูล: ${PDF_PATH} หน้า ${FIRST_PAGE}–${LAST_PAGE}`,
    `หมวด/กลุ่มวิชา: ${data.categories.length}`,
    `รายวิชาทั้งหมด: ${data.courses.length}`,
    "",
    "จำนวนรายวิชาต่อหมวด/กลุ่ม:",
    ...data.categories.map((cat) => {
      const n = data.courses.filter((c) => c.categoryCode === cat.code).length;
      return `  ${cat.code.padEnd(4)} ${cat.name} — ${n} วิชา (ขั้นต่ำ ${cat.minCredits ?? "-"} หน่วยกิต)`;
    }),
    `  (ไม่มีหมวด) — ${data.courses.filter((c) => c.categoryCode === null).length} วิชา`,
    "",
    `รายวิชาที่ต้องตรวจสอบ: ${flagged.length}`,
    ...flagged.map((c) => `  ${c.code} ${c.nameTh} (หน้า ${c.sourcePage ?? "-"}): ${c.reviewReasons.join("; ")}`),
    "",
  ].join("\n");

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "courses.json"), JSON.stringify(data, null, 1) + "\n");
  fs.writeFileSync(path.join(OUT_DIR, "report.txt"), report);
  console.log(report);

  if (data.courses.length === 0) {
    console.error("ไม่พบรายวิชาเลย ตรวจสอบไฟล์ PDF และช่วงหน้า");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
