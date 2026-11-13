import { cache } from "react";
import { notFound } from "next/navigation";
import { getProgramByCode, levelLabel, type ProgramSummary } from "@/lib/programs";

/** The program named in the URL, or a 404; cached so layout, metadata and page share one query. */
export const programFromParams = cache(async (code: string): Promise<ProgramSummary> => {
  const program = await getProgramByCode(code);
  if (!program) notFound();
  return program;
});

export const programTitle = (p: ProgramSummary) => `${p.name} (${levelLabel(p.level)}) — ฐานข้อมูลรายวิชา`;
