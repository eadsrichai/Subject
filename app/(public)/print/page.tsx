import Link from "next/link";
import { CourseTable } from "@/components/course-table";
import { PrintButton } from "@/components/print-button";
import { allMatchingCourses, filterToQuery, listCategories, parseFilter } from "@/lib/courses";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function PrintPage({ searchParams }: Props) {
  const filter = parseFilter(await searchParams);
  const [items, categories] = await Promise.all([allMatchingCourses(filter), listCategories()]);
  const category = categories.find((c) => c.id === filter.categoryId);

  const conditions = [
    filter.q && `คำค้น: ${filter.q}`,
    category && `หมวดวิชา: ${category.code} ${category.name}`,
    filter.credits !== null && `หน่วยกิต: ${filter.credits}`,
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="no-print flex items-center gap-3">
        <PrintButton />
        <Link href={`/${filterToQuery({ ...filter, page: 1 })}`} className="link text-sm">
          กลับไปหน้ารายวิชา
        </Link>
      </div>
      <header>
        <h1 className="text-xl font-semibold">รายวิชา หลักสูตร ปวส. พุทธศักราช 2567</h1>
        <p className="text-slate-700">สาขาวิชาเทคโนโลยีสารสนเทศ</p>
        <p className="mt-1 text-sm text-slate-600">
          {conditions.length > 0 ? conditions.join(" · ") : "ทุกรายวิชา"} — {items.length} รายวิชา
        </p>
      </header>
      <CourseTable items={items} />
    </div>
  );
}
