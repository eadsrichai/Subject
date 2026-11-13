import type { Level } from "@prisma/client";
import { levelLabel } from "@/lib/programs";

/** "ปวช. เทคโนโลยีสารสนเทศ" */
export function ProgramBadge({ program }: { program: { level: Level; name: string } }) {
  return (
    <span className="inline-block whitespace-nowrap rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-700">
      {levelLabel(program.level)} {program.name}
    </span>
  );
}
