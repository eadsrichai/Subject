import Link from "next/link";
import { CourseTable } from "@/components/course-table";
import { PrintButton } from "@/components/print-button";
import { allMatchingCourses, filterToQuery, listCategories, parseFilter } from "@/lib/courses";
import { levelLabel } from "@/lib/programs";
import { programFromParams } from "../program";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PrintPage({ params, searchParams }: Props) {
  const program = await programFromParams((await params).code);
  const filter = { ...parseFilter(await searchParams), programId: program.id };
  const [items, categories] = await Promise.all([allMatchingCourses(filter), listCategories(program.id)]);
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
        <Link href={`/p/${program.code}${filterToQuery({ ...filter, page: 1 })}`} className="link text-sm">
          กลับไปหน้ารายวิชา
        </Link>
      </div>
      <header>
        <h1 className="text-xl font-semibold">รายวิชา หลักสูตร {levelLabel(program.level)} พุทธศักราช 2567</h1>
        <p className="text-slate-700">
          สาขาวิชา{program.name} (รหัส {program.code})
        </p>
        <p className="mt-1 text-sm text-slate-600">
          {conditions.length > 0 ? conditions.join(" · ") : "ทุกรายวิชา"} — {items.length} รายวิชา
        </p>
      </header>
      <CourseTable items={items} />
    </div>
  );
}
