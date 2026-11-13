import type { Metadata } from "next";
import Link from "next/link";
import { CourseFilters } from "@/components/course-filters";
import { CourseTable } from "@/components/course-table";
import { Pagination } from "@/components/pagination";
import { filterToQuery, listCreditValues, parseFilter, searchCourses } from "@/lib/courses";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "ค้นหารายวิชาทุกสาขา — ฐานข้อมูลรายวิชา" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function SearchPage({ searchParams }: Props) {
  // Categories belong to a program, so the cross-program search has no category filter.
  const filter = { ...parseFilter(await searchParams), programId: null, categoryId: null };
  const [result, creditValues] = await Promise.all([searchCourses(filter), listCreditValues(null)]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">ค้นหารายวิชาทุกสาขา</h1>
      <CourseFilters action="/search" filter={filter} creditValues={creditValues} />
      <p className="text-sm text-slate-600">พบ {result.total} รายวิชา</p>

      {result.total === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-slate-700">ไม่พบรายวิชาที่ตรงกับเงื่อนไข</p>
          <Link href="/search" className="btn-secondary mt-4">
            ล้างตัวกรอง
          </Link>
        </div>
      ) : (
        <>
          <CourseTable items={result.items} hrefFor={(c) => `/courses/${encodeURIComponent(c.code)}`} showPrograms />
          <Pagination
            page={result.page}
            pageCount={result.pageCount}
            hrefFor={(page) => `/search${filterToQuery({ ...filter, page })}`}
          />
        </>
      )}
    </div>
  );
}
