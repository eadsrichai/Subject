import { foldThai } from "../../lib/normalize-thai";
import type { Line } from "./lines";

export type CourseRow = {
  code: string;
  nameTh: string;
  theoryHours: number;
  practiceHours: number;
  credits: number;
};

export type ExtractedCategory = {
  code: string;
  name: string;
  minCredits: number | null;
  parentCode: string | null;
  sortOrder: number;
};

export type ExtractedCourse = CourseRow & {
  nameEn: string;
  categoryCode: string | null;
  standardRef: string | null;
  learningOutcome: string | null;
  objectives: string | null;
  competencies: string | null;
  description: string | null;
  sourcePage: number | null;
  needsReview: boolean;
  reviewReasons: string[];
};

export type Extracted = { categories: ExtractedCategory[]; courses: ExtractedCourse[] };

const HOURS_COLUMN_X = 460; // ท-ป-น sits at the right edge of every table
const TITLE_X = 150; // centred section titles start right of this; headings start at the margin
const PRE = { code: "PRE", name: "รายวิชาปรับพื้นฐานวิชาชีพ", minCredits: 15 };

const SECTION_KEYS = ["standardRef", "learningOutcome", "objectives", "competencies", "description"] as const;
type SectionKey = (typeof SECTION_KEYS)[number];
const SECTION_TITLES: Record<SectionKey, string> = {
  standardRef: "อ้างอิงมาตรฐาน",
  learningOutcome: "ผลลัพธ์การเรียนรู้ระดับรายวิชา",
  objectives: "จุดประสงค์รายวิชา",
  competencies: "สมรรถนะรายวิชา",
  description: "คำอธิบายรายวิชา",
};

// Bold headings come out with "ำ" in place of "า" and stray spaces, so match loosely.
const SECTIONS = SECTION_KEYS.map((key) => {
  const folded = foldThai(SECTION_TITLES[key]);
  const pattern = [...folded]
    .map((ch) => (ch === "า" ? "[าำ]" : ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    .join("\\s*");
  return { key, folded, strip: new RegExp(`^\\s*${pattern}\\s*`) };
});

const GROUP_LABEL = /^(รายวิชาปรับพื้นฐานวิชาชีพ|หมวดวิชา|กลุ่มสมรรถนะ|กิจกรรมเสริมหลักสูตร)/;
const isThai = (ch: string | undefined) => !!ch && ch >= "ก" && ch <= "๎";
const dashes = (s: string) => s.replace(/\s/g, "").replace(/[–—]/g, "-");

export function parseCourseRow(line: Line): CourseRow | null {
  let code = "";
  let i = 0;
  while (i < line.cells.length && !/^\d{5}-\d{4}$/.test(code)) {
    if (!/^[\d\s\-–—]+$/.test(line.cells[i].text)) return null;
    code += dashes(line.cells[i].text);
    i++;
  }
  if (!/^\d{5}-\d{4}$/.test(code)) return null;

  const rest = line.cells.slice(i);
  const hours = dashes(rest.filter((c) => c.x >= HOURS_COLUMN_X).map((c) => c.text).join(""));
  const m = hours.match(/^(\d{1,2})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return null;

  const nameTh = rest.filter((c) => c.x < HOURS_COLUMN_X).map((c) => c.text).join(" ").trim();
  if (!nameTh) return null;

  return { code, nameTh, theoryHours: +m[1], practiceHours: +m[2], credits: +m[3] };
}

export function parseCategoryHeading(
  line: Line,
): { code: string; name: string; minCredits: number | null } | null {
  const [num, title, ...rest] = line.cells;
  if (!num || !title) return null;
  if (!/^\d(\.\d)*\.?$/.test(num.text)) return null;
  if (!/^(หมวด|กลุ่ม|กิจกรรมเสริมหลักสูตร)/.test(title.text)) return null;
  const credits = rest.map((c) => c.text).join("").replace(/\s/g, "").match(/(\d+)หน่วยกิต/);
  return {
    code: num.text.replace(/\.$/, ""),
    name: title.text,
    minCredits: credits ? +credits[1] : null,
  };
}

type Block = {
  row: CourseRow;
  nameEn: string;
  page: number;
  sections: Partial<Record<SectionKey, string>>;
  current: SectionKey | null;
};

function appendText(existing: string | undefined, text: string): string {
  const next = text.replace(/^(\d+)\s*\.\s*/, "$1. ");
  if (!existing) return next;
  if (/^\d+\. /.test(next)) return `${existing}\n${next}`;
  const glue = isThai(existing.at(-1)) && isThai(next[0]) ? "" : " ";
  return existing + glue + next;
}

const isEnglishName = (line: Line | undefined) =>
  !!line && /^[\x20-\x7E]+$/.test(line.text) && /[A-Za-z]/.test(line.text);

export function parseDocument(lines: Line[]): Extracted {
  const rows = lines.map(parseCourseRow);
  const folded = lines.map((l) => foldThai(l.text));
  const standardRef = SECTIONS[0].folded;

  // A course row opens a description block when "อ้างอิงมาตรฐาน" follows closely.
  const opensBlock = rows.map((row, i) => {
    if (!row) return false;
    for (let j = i + 1; j <= i + 3 && j < lines.length; j++) {
      if (rows[j]) return false;
      if (folded[j].startsWith(standardRef)) return true;
    }
    return false;
  });
  // A group label printed directly above a block belongs to that block, not the previous one.
  const isLabelAboveBlock = lines.map(
    (l, i) => !!opensBlock[i + 1] && l.page === lines[i + 1].page && GROUP_LABEL.test(folded[i]),
  );

  const categories = new Map<string, ExtractedCategory>();
  const tableCourses = new Map<string, { row: CourseRow; nameEn: string; categoryCode: string | null }>();
  const blocks = new Map<string, Block>();
  let currentCategory: string | null = null;
  let block: Block | null = null;

  const noteCategory = (c: { code: string; name: string; minCredits: number | null }) => {
    const known = categories.get(c.code);
    if (!known) {
      const cut = c.code.lastIndexOf(".");
      categories.set(c.code, {
        ...c,
        parentCode: cut === -1 ? null : c.code.slice(0, cut),
        sortOrder: c.code === PRE.code ? -1 : categories.size,
      });
    } else if (known.minCredits === null) {
      known.minCredits = c.minCredits;
    }
    currentCategory = c.code;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isPreLabel =
      folded[i].startsWith(foldThai(PRE.name)) || folded[i].includes("ปรับพื้นฐานวิชาชีพจานวน");

    if (opensBlock[i]) {
      block = { row: rows[i]!, nameEn: "", page: line.page, sections: {}, current: null };
      if (!blocks.has(block.row.code)) blocks.set(block.row.code, block);
      if (isEnglishName(lines[i + 1])) block.nameEn = lines[++i].text;
      continue;
    }

    const heading = parseCategoryHeading(line);
    const isSectionTitlePage = SECTIONS.some((s) => folded[i] === s.folded) && line.cells[0].x > TITLE_X;

    if (block && !heading && !isSectionTitlePage && !isLabelAboveBlock[i]) {
      const section = line.cells[0].x <= TITLE_X && SECTIONS.find((s) => folded[i].startsWith(s.folded));
      if (section) {
        block.current = section.key;
        const inline = line.text.replace(section.strip, "").trim();
        if (inline && !(section.key === "objectives" && foldThai(inline) === "เพื่อให้")) {
          block.sections[section.key] = appendText(block.sections[section.key], inline);
        }
      } else if (block.current) {
        block.sections[block.current] = appendText(block.sections[block.current], line.text);
      }
      continue;
    }

    block = null;
    if (heading) noteCategory(heading);
    else if (isPreLabel) noteCategory(PRE);
    else if (rows[i] && !tableCourses.has(rows[i]!.code)) {
      const nameEn = isEnglishName(lines[i + 1]) ? lines[i + 1].text : "";
      tableCourses.set(rows[i]!.code, { row: rows[i]!, nameEn, categoryCode: currentCategory });
    }
  }

  const codes = [...new Set([...tableCourses.keys(), ...blocks.keys()])].sort();
  const courses = codes.map((code): ExtractedCourse => {
    const table = tableCourses.get(code);
    const b = blocks.get(code);
    const row = table?.row ?? b!.row;
    const reasons: string[] = [];
    const hours = (r: CourseRow) => `${r.theoryHours}-${r.practiceHours}-${r.credits}`;

    if (!table) reasons.push("ไม่พบในตารางโครงสร้าง");
    if (!b) reasons.push("ไม่พบคำอธิบายรายวิชา");
    if (table && b && hours(table.row) !== hours(b.row)) {
      reasons.push(`ท-ป-น ไม่ตรงกัน (ตาราง ${hours(table.row)}, คำอธิบาย ${hours(b.row)})`);
    }
    if (b) {
      for (const key of SECTION_KEYS) {
        if (!b.sections[key]) reasons.push(`ขาดหัวข้อ: ${SECTION_TITLES[key]}`);
      }
    }

    return {
      ...row,
      nameEn: table?.nameEn || b?.nameEn || "",
      categoryCode: table?.categoryCode ?? null,
      standardRef: b?.sections.standardRef ?? null,
      learningOutcome: b?.sections.learningOutcome ?? null,
      objectives: b?.sections.objectives ?? null,
      competencies: b?.sections.competencies ?? null,
      description: b?.sections.description ?? null,
      sourcePage: b?.page ?? null,
      needsReview: reasons.length > 0,
      reviewReasons: reasons,
    };
  });

  return { categories: [...categories.values()], courses };
}
