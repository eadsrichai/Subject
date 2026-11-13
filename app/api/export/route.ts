import { allMatchingCourses, parseFilter } from "@/lib/courses";
import { XLSX_MIME, coursesToXlsx } from "@/lib/export";
import { getProgramByCode } from "@/lib/programs";

export const dynamic = "force-dynamic";

/** Excel of one program's courses matching the list's filter: `?program=<code>&q=…&category=…&credits=…`. */
export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const program = await getProgramByCode(params.program ?? "");
  if (!program) return new Response("ไม่พบหลักสูตร", { status: 404 });
  const items = await allMatchingCourses({ ...parseFilter(params), programId: program.id });
  const body = await coursesToXlsx(items);
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": XLSX_MIME,
      "Content-Disposition": `attachment; filename="courses-${program.code}-${stamp}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
