// Scan every page of a PDF for Thai text-extraction damage.
//
// Reports per page: Thai letter count, tone-mark/thanthakhat rate, split
// sara-am count, private-use/unknown characters. A healthy Thai page has
// roughly 8-14 tone marks + thanthakhat per 100 Thai letters.
//
// Usage: node scripts/scan-pdf-quality.mjs <pdf> [out.json]
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const [pdfPath, outFile] = process.argv.slice(2);
if (!pdfPath) {
  console.error("Usage: node scripts/scan-pdf-quality.mjs <pdf> [out.json]");
  process.exit(1);
}

const require = createRequire(import.meta.url);
const pdfjsRoot = path.dirname(require.resolve("pdfjs-dist/package.json"));
const assetUrl = (dir) => pathToFileURL(path.join(pdfjsRoot, dir)).href + "/";

const doc = await getDocument({
  data: new Uint8Array(fs.readFileSync(pdfPath)),
  cMapUrl: assetUrl("cmaps"),
  cMapPacked: true,
  standardFontDataUrl: assetUrl("standard_fonts"),
  verbosity: 0,
}).promise;

const count = (s, re) => (s.match(re) ?? []).length;
const oddChars = new Map(); // codepoint -> { n, pages:Set }
const rows = [];

for (let p = 1; p <= doc.numPages; p++) {
  const page = await doc.getPage(p);
  const tc = await page.getTextContent();
  const text = tc.items.map((it) => it.str ?? "").join("");
  const fonts = new Set(tc.items.map((it) => it.fontName).filter(Boolean));
  page.cleanup();

  const thai = count(text, /[ก-ฮ]/g); // consonants
  const marks = count(text, /[่-์]/g); // tone marks + thanthakhat
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    const known =
      cp < 0x7f || (cp >= 0x0e00 && cp <= 0x0e7f) || (cp >= 0x2010 && cp <= 0x2027);
    if (known) continue;
    const e = oddChars.get(cp) ?? { n: 0, pages: new Set() };
    e.n++;
    e.pages.add(p);
    oddChars.set(cp, e);
  }
  rows.push({
    page: p,
    thai,
    marksPer100: thai ? +((marks / thai) * 100).toFixed(1) : null,
    splitSaraAm: count(text, /[ก-ฮ่-๋] +ำ/g), // "ค ำ"
    decomposedSaraAm: count(text, /ํา/g), // nikhahit + sara aa
    amAsAa: count(text, /ำ[ก-ฮ]ำ|[ก-ฮ]ำย/g), // "บำย", "ชำ" runs
    pua: count(text, /[-]/g),
    fonts: fonts.size,
  });
}

console.log("page thai marks/100 splitAm decompAm amAsAa pua");
for (const r of rows) {
  if (!r.thai) continue;
  console.log(
    [r.page, r.thai, r.marksPer100, r.splitSaraAm, r.decomposedSaraAm, r.amAsAa, r.pua]
      .map((v) => String(v).padStart(6))
      .join(" "),
  );
}
console.log("\nunexpected characters:");
for (const [cp, e] of [...oddChars].sort((a, b) => b[1].n - a[1].n)) {
  const pages = [...e.pages];
  console.log(
    `U+${cp.toString(16).toUpperCase().padStart(4, "0")} x${e.n} pages ${pages.slice(0, 12).join(",")}${pages.length > 12 ? ",…" : ""}`,
  );
}
if (outFile) fs.writeFileSync(outFile, JSON.stringify(rows, null, 1));
