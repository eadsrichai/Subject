import { allMatchingCourses, parseFilter } from "@/lib/courses";
import { XLSX_MIME, coursesToXlsx } from "@/lib/export";
import { listPrograms } from "@/lib/programs";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  // Temporary until the `program` parameter: the first program is the current one.
  const program = (await listPrograms())[0];
  const items = await allMatchingCourses({ ...parseFilter(params), programId: program?.id ?? null });
  const body = await coursesToXlsx(items);
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": XLSX_MIME,
      "Content-Disposition": `attachment; filename="courses-${stamp}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
