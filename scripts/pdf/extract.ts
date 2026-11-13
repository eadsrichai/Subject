// Curriculum PDF → Data/extracted/<code>.json + <code>.report.txt, driven by Data/programs.json
// Usage: npm run extract -- [code…]   (no code = every program in the registry)
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { extractedPath, loadRegistry, reportPath, type ProgramEntry } from "../../lib/program-registry";
import { buildLines, type Item, type Line } from "./lines";
import { parseDocument } from "./parse";

/** Returns false when the program was read but yielded no courses. */
async function extractProgram(program: ProgramEntry): Promise<boolean> {
  const pdfPath = `Data/${program.pdf}`;
  const [firstPage, lastPage] = program.pages;
  if (!fs.existsSync(pdfPath)) {
    console.log(`ข้าม ${program.code}: ไม่พบไฟล์ ${pdfPath}`);
    return true;
  }

  const pdfjsRoot = path.resolve("node_modules/pdfjs-dist");
  const assetUrl = (dir: string) => pathToFileURL(path.join(pdfjsRoot, dir)).href + "/";
  const doc = await getDocument({
    data: new Uint8Array(fs.readFileSync(pdfPath)),
    cMapUrl: assetUrl("cmaps"),
    cMapPacked: true,
    standardFontDataUrl: assetUrl("standard_fonts"),
    verbosity: 0,
  }).promise;

  const lines: Line[] = [];
  for (let p = firstPage; p <= Math.min(lastPage, doc.numPages); p++) {
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
    `แหล่งข้อมูล: ${pdfPath} หน้า ${firstPage}–${lastPage}`,
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

  fs.mkdirSync(path.dirname(extractedPath(program.code)), { recursive: true });
  fs.writeFileSync(extractedPath(program.code), JSON.stringify(data, null, 1) + "\n");
  fs.writeFileSync(reportPath(program.code), report);
  console.log(report);

  if (data.courses.length === 0) {
    console.error(`${program.code}: ไม่พบรายวิชาเลย ตรวจสอบไฟล์ PDF และช่วงหน้า`);
    return false;
  }
  return true;
}

async function main() {
  const registry = loadRegistry();
  const codes = process.argv.slice(2);
  const unknown = codes.filter((c) => !registry.some((p) => p.code === c));
  if (unknown.length > 0) {
    console.error(`ไม่พบรหัสสาขา ${unknown.join(", ")} ในทะเบียน Data/programs.json`);
    process.exit(1);
  }
  const selected = codes.length > 0 ? registry.filter((p) => codes.includes(p.code)) : registry;
  let ok = true;
  for (const program of selected) ok = (await extractProgram(program)) && ok;
  if (!ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
