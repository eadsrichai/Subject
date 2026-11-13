import Link from "next/link";
import { CourseFilters } from "@/components/course-filters";
import { CourseTable } from "@/components/course-table";
import { Pagination } from "@/components/pagination";
import { filterToQuery, listCategories, listCreditValues, parseFilter, searchCourses } from "@/lib/courses";
import { programFromParams } from "./program";
import { withBasePath } from "@/lib/base-path";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProgramCoursesPage({ params, searchParams }: Props) {
  const program = await programFromParams((await params).code);
  const base = `/p/${program.code}`;
  const filter = { ...parseFilter(await searchParams), programId: program.id };
  const [result, categories, creditValues] = await Promise.all([
    searchCourses(filter),
    listCategories(program.id),
    listCreditValues(program.id),
  ]);
  const query = filterToQuery({ ...filter, page: 1 });
  const exportQuery = query ? `?program=${program.code}&${query.slice(1)}` : `?program=${program.code}`;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">รายวิชา</h1>
      <CourseFilters action={base} filter={filter} categories={categories} creditValues={creditValues} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">พบ {result.total} รายวิชา</p>
        {result.total > 0 && (
          <div className="flex gap-2">
            <a href={withBasePath(`/api/export${exportQuery}`)} className="btn-secondary">
              ส่งออก Excel
            </a>
            <Link href={`${base}/print${query}`} className="btn-secondary">
              พิมพ์ / บันทึก PDF
            </Link>
          </div>
        )}
      </div>

      {result.total === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-slate-700">ไม่พบรายวิชาที่ตรงกับเงื่อนไข</p>
          <Link href={base} className="btn-secondary mt-4">
            ล้างตัวกรอง
          </Link>
        </div>
      ) : (
        <>
          <CourseTable
            items={result.items}
            hrefFor={(c) => `/courses/${encodeURIComponent(c.code)}?from=${program.code}`}
          />
          <Pagination
            page={result.page}
            pageCount={result.pageCount}
            hrefFor={(page) => `${base}${filterToQuery({ ...filter, page })}`}
          />
        </>
      )}
    </div>
  );
}
