import Link from "next/link";
import { ProgramBadge } from "@/components/program-badge";
import type { CourseListItem } from "@/lib/courses";

type Props = {
  items: CourseListItem[];
  /** Where a course code links to; omit for a plain (printable) table. */
  hrefFor?: (item: CourseListItem) => string;
  showReviewFlag?: boolean;
  /** Cross-program list: show each course's programs instead of its category in one program. */
  showPrograms?: boolean;
};

export function CourseTable({ items, hrefFor, showReviewFlag, showPrograms }: Props) {
  return (
    <div className="card overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col" className="whitespace-nowrap">
              รหัสวิชา
            </th>
            <th scope="col">ชื่อวิชา</th>
            <th scope="col" className="whitespace-nowrap">
              ท-ป-น
            </th>
            <th scope="col">{showPrograms ? "หลักสูตร" : "หมวด/กลุ่มวิชา"}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr key={c.id}>
              <td className="whitespace-nowrap font-mono">
                {hrefFor ? (
                  <Link href={hrefFor(c)} className="link">
                    {c.code}
                  </Link>
                ) : (
                  c.code
                )}
              </td>
              <td>
                <div>
                  {c.nameTh}
                  {showReviewFlag && c.needsReview && (
                    <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900">
                      ต้องตรวจสอบ
                    </span>
                  )}
                </div>
                {c.nameEn && <div className="text-slate-500">{c.nameEn}</div>}
              </td>
              <td className="whitespace-nowrap font-mono">
                {c.theoryHours}-{c.practiceHours}-{c.credits}
              </td>
              {showPrograms ? (
                <td>
                  {c.programs.length === 0 ? (
                    <span className="text-slate-500">—</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {c.programs.map((p) => (
                        <ProgramBadge key={p.code} program={p} />
                      ))}
                    </div>
                  )}
                </td>
              ) : (
                <td className="text-slate-600">{c.categoryName}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
