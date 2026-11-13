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
