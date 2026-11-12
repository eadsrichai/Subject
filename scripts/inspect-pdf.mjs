// Inspect a PDF's structure: page count, text density per page, and
// position-aware line dumps of selected pages.
//
// Usage: node scripts/inspect-pdf.mjs <pdf> <outDir> [pages e.g. 1-5,40,120]
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const [pdfPath, outDir, pageSpec = "1-5"] = process.argv.slice(2);
if (!pdfPath || !outDir) {
  console.error("Usage: node scripts/inspect-pdf.mjs <pdf> <outDir> [pages]");
  process.exit(1);
}

const require = createRequire(import.meta.url);
const pdfjsRoot = path.dirname(require.resolve("pdfjs-dist/package.json"));
const assetUrl = (dir) => pathToFileURL(path.join(pdfjsRoot, dir)).href + "/";

function parsePages(spec, max) {
  const pages = new Set();
  for (const part of spec.split(",")) {
    const [a, b = a] = part.split("-").map(Number);
    for (let p = a; p <= Math.min(b, max); p++) if (p >= 1) pages.add(p);
  }
  return [...pages].sort((x, y) => x - y);
}

// Group text items into visual lines by their baseline (y), then order by x.
function toLines(items) {
  const rows = new Map();
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue;
    const x = Math.round(it.transform[4]);
    const y = Math.round(it.transform[5] / 3) * 3;
    if (!rows.has(y)) rows.set(y, []);
    rows.get(y).push({ x, str: it.str });
  }
  return [...rows.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([y, cells]) => {
      cells.sort((a, b) => a.x - b.x);
      return `y=${String(y).padStart(4)} | ` + cells.map((c) => `[${c.x}]${c.str}`).join("  ");
    });
}

const data = new Uint8Array(fs.readFileSync(pdfPath));
const doc = await getDocument({
  data,
  cMapUrl: assetUrl("cmaps"),
  cMapPacked: true,
  standardFontDataUrl: assetUrl("standard_fonts"),
  verbosity: 0,
}).promise;

fs.mkdirSync(outDir, { recursive: true });
const meta = await doc.getMetadata().catch(() => null);
console.log(`pages: ${doc.numPages}`);
console.log(`info: ${JSON.stringify(meta?.info ?? {})}`);

// Pass 1: text density of every page (detects scanned/image-only pages).
const density = [];
for (let p = 1; p <= doc.numPages; p++) {
  const page = await doc.getPage(p);
  const tc = await page.getTextContent();
  const chars = tc.items.reduce((n, it) => n + (it.str?.length ?? 0), 0);
  density.push({ page: p, items: tc.items.length, chars });
  page.cleanup();
}
const empty = density.filter((d) => d.chars < 20).map((d) => d.page);
const totalChars = density.reduce((n, d) => n + d.chars, 0);
console.log(`total chars: ${totalChars}`);
console.log(`pages with <20 chars (likely images): ${empty.length}/${doc.numPages}`);
fs.writeFileSync(path.join(outDir, "density.json"), JSON.stringify(density));

// Pass 2: dump requested pages with positions.
for (const p of parsePages(pageSpec, doc.numPages)) {
  const page = await doc.getPage(p);
  const vp = page.getViewport({ scale: 1 });
  const tc = await page.getTextContent();
  const lines = toLines(tc.items);
  const file = path.join(outDir, `page-${String(p).padStart(4, "0")}.txt`);
  fs.writeFileSync(
    file,
    `# page ${p} size=${Math.round(vp.width)}x${Math.round(vp.height)} items=${tc.items.length}\n` +
      lines.join("\n") + "\n",
  );
  console.log(`wrote ${file} (${lines.length} lines)`);
}
