import fs from "node:fs";
import { z } from "zod";

/** One program in the registry (`Data/programs.json`): where its curriculum PDF is and which pages to read. */
export const programEntrySchema = z.object({
  code: z.string().regex(/^\d{5}$/, "รหัสสาขาต้องเป็นตัวเลข 5 หลัก"),
  level: z.enum(["PVC", "PVS"]),
  name: z.string().trim().min(1),
  typeName: z.string().trim().min(1),
  pdf: z.string().trim().min(1),
  pages: z
    .tuple([z.number().int().positive(), z.number().int().positive()])
    .refine(([from, to]) => from <= to, "หน้าเริ่มต้องไม่มากกว่าหน้าสุดท้าย"),
});

export type ProgramEntry = z.infer<typeof programEntrySchema>;

export const REGISTRY_FILE = "Data/programs.json";

export const extractedPath = (code: string) => `Data/extracted/${code}.json`;
export const reportPath = (code: string) => `Data/extracted/${code}.report.txt`;

/** Reads and validates the registry. Order in the file is the order returned. Throws with the file name and the failing position. */
export function loadRegistry(file: string = REGISTRY_FILE): ProgramEntry[] {
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    throw new Error(`${file}: อ่านไฟล์หรือแปลง JSON ไม่ได้ (${err instanceof Error ? err.message : err})`);
  }
  const parsed = z.array(programEntrySchema).safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => {
      const where = i.path.map((p) => (typeof p === "number" ? `[${p}]` : `.${p}`)).join("").replace(/^\./, "");
      return `${where || "(ราก)"}: ${i.message}`;
    });
    throw new Error(`${file}: ${issues.join("; ")}`);
  }
  const seen = new Set<string>();
  for (const p of parsed.data) {
    if (seen.has(p.code)) throw new Error(`${file}: รหัสสาขาซ้ำ ${p.code}`);
    seen.add(p.code);
  }
  return parsed.data;
}
