import { normalizeThai } from "../../lib/normalize-thai";

export type Item = { str: string; x: number; y: number; width: number };
export type Cell = { x: number; text: string };
export type Line = { page: number; y: number; cells: Cell[]; text: string };

const HEADER_Y = 780; // page number
const FOOTER_Y = 80; // running footer
const SAME_LINE_TOLERANCE = 4; // a row's Thai name can sit ~3pt off its code
const CELL_GAP = 2; // touching fragments belong to one word

/** Groups a page's text items into visual lines of cells, top to bottom. */
export function buildLines(page: number, items: Item[]): Line[] {
  const visible = items
    .filter((it) => it.str.trim() !== "" && it.y <= HEADER_Y && it.y >= FOOTER_Y)
    .sort((a, b) => b.y - a.y);

  const rows: Item[][] = [];
  for (const it of visible) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(row[0].y - it.y) <= SAME_LINE_TOLERANCE) row.push(it);
    else rows.push([it]);
  }

  return rows.map((row) => {
    row.sort((a, b) => a.x - b.x);
    const raw: { x: number; str: string; end: number }[] = [];
    for (const it of row) {
      const last = raw[raw.length - 1];
      if (last && it.x - last.end < CELL_GAP) {
        last.str += it.str;
        last.end = it.x + it.width;
      } else {
        raw.push({ x: it.x, str: it.str, end: it.x + it.width });
      }
    }
    const cells = raw
      .map((c) => ({ x: c.x, text: normalizeThai(c.str) }))
      .filter((c) => c.text !== "");
    return { page, y: row[0].y, cells, text: cells.map((c) => c.text).join(" ") };
  });
}
