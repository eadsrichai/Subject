import type { PlacementProgram } from "@/components/placements-field";
import { listCategories } from "@/lib/courses";
import { listPrograms } from "@/lib/programs";

/** Every program with its categories, for the course form's placement rows. */
export async function formPrograms(): Promise<PlacementProgram[]> {
  const programs = await listPrograms();
  return Promise.all(
    programs.map(async (p) => ({
      id: p.id,
      code: p.code,
      level: p.level,
      name: p.name,
      categories: (await listCategories(p.id)).map(({ id, code, name, depth }) => ({ id, code, name, depth })),
    })),
  );
}
