import Link from "next/link";
import { CourseFilters } from "@/components/course-filters";
import { CourseTable } from "@/components/course-table";
import { Pagination } from "@/components/pagination";
import { requireRoleOrLogin } from "@/lib/authz";
import { filterToQuery, listCategories, listCreditValues, parseFilter, searchCourses } from "@/lib/courses";
import { levelLabel, listPrograms } from "@/lib/programs";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AdminCoursesPage({ searchParams }: Props) {
  await requireRoleOrLogin("ADMIN", "STAFF");
  const sp = await searchParams;
  const programs = await listPrograms();
  // An unknown program code means "every program", like other malformed filters.
  const program = programs.find((p) => p.code === sp.program) ?? null;
  const filter = { ...parseFilter(sp), programId: program?.id ?? null };
  if (!program) filter.categoryId = null;
  const reviewOnly = sp.review === "1";
  const [result, categories, creditValues] = await Promise.all([
    searchCourses(filter, reviewOnly ? { needsReview: true } : {}),
    program ? listCategories(program.id) : undefined,
    listCreditValues(filter.programId),
  ]);
  const pageHref = (page: number) => {
    const params = new URLSearchParams(filterToQuery({ ...filter, page }).slice(1));
    if (program) params.set("program", program.code);
    if (reviewOnly) params.set("review", "1");
    const query = params.toString();
    return `/admin/courses${query ? `?${query}` : ""}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">จัดการรายวิชา</h1>
        <Link href="/admin/courses/new" className="btn">
          เพิ่มรายวิชา
        </Link>
      </div>
      <CourseFilters
        action="/admin/courses"
        filter={filter}
        categories={categories}
        creditValues={creditValues}
        reviewOnly={reviewOnly}
        programs={programs.map((p) => ({ code: p.code, label: `${levelLabel(p.level)} ${p.name} (${p.code})` }))}
        programCode={program?.code}
      />
      <p className="text-sm text-slate-600">พบ {result.total} รายวิชา — คลิกรหัสวิชาเพื่อแก้ไข</p>
      {result.total === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-slate-700">ไม่พบรายวิชาที่ตรงกับเงื่อนไข</p>
          <Link href="/admin/courses" className="btn-secondary mt-4">
            ล้างตัวกรอง
          </Link>
        </div>
      ) : (
        <>
          <CourseTable items={result.items} hrefFor={(c) => `/admin/courses/${c.id}`} showReviewFlag showPrograms />
          <Pagination page={result.page} pageCount={result.pageCount} hrefFor={pageHref} />
        </>
      )}
    </div>
  );
}
