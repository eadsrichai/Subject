import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { getCourseByCode } from "@/lib/courses";
import { levelLabel } from "@/lib/programs";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function decode(code: string): string {
  try {
    return decodeURIComponent(code);
  } catch {
    return code; // malformed escape: treat as a literal code, which simply won't be found
  }
}

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const course = await getCourseByCode(decode((await params).code));
  return { title: course ? `${course.code} ${course.nameTh}` : "ไม่พบรายวิชา" };
}

export default async function CourseDetailPage({ params, searchParams }: Props) {
  const course = await getCourseByCode(decode((await params).code));
  if (!course) notFound();
  const from = (await searchParams).from;
  // Only a program this course is actually in gets a "back" link; anything else is ignored.
  const back = course.placements.find((p) => p.program.code === from)?.program;

  const sections: [string, string | null][] = [
    ["อ้างอิงมาตรฐาน", course.standardRef],
    ["ผลลัพธ์การเรียนรู้ระดับรายวิชา", course.learningOutcome],
    ["จุดประสงค์รายวิชา", course.objectives],
    ["สมรรถนะรายวิชา", course.competencies],
    ["คำอธิบายรายวิชา", course.description],
  ];

  return (
    <article className="space-y-5">
      <nav aria-label="เส้นทาง" className="no-print text-sm text-slate-600">
        {back ? (
          <Link href={`/p/${back.code}`} className="link">
            ← กลับไปหน้ารายวิชา {levelLabel(back.level)} {back.name}
          </Link>
        ) : (
          <Link href="/" className="link">
            ← หลักสูตร
          </Link>
        )}
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            <span className="font-mono">{course.code}</span> {course.nameTh}
          </h1>
          {course.nameEn && <p className="text-lg text-slate-600">{course.nameEn}</p>}
          <p className="mt-2 text-sm text-slate-700">
            ทฤษฎี {course.theoryHours} ชม. ปฏิบัติ {course.practiceHours} ชม. {course.credits} หน่วยกิต
            <span className="ml-2 font-mono text-slate-500">
              (ท-ป-น {course.theoryHours}-{course.practiceHours}-{course.credits})
            </span>
          </p>
        </div>
        <PrintButton label="พิมพ์" />
      </header>

      <section className="space-y-2">
        <h2 className="font-semibold text-slate-800">อยู่ในหลักสูตร</h2>
        {course.placements.length === 0 ? (
          <p className="card p-4 text-slate-600">ยังไม่อยู่ในหลักสูตรใด</p>
        ) : (
          <div className="card overflow-x-auto">
            <table className="data-table" aria-label="อยู่ในหลักสูตร">
              <thead>
                <tr>
                  <th scope="col">ระดับ</th>
                  <th scope="col">สาขาวิชา</th>
                  <th scope="col">หมวด/กลุ่มวิชา</th>
                </tr>
              </thead>
              <tbody>
                {course.placements.map((p) => (
                  <tr key={p.program.code}>
                    <td className="whitespace-nowrap">{levelLabel(p.program.level)}</td>
                    <td>
                      <Link href={`/p/${p.program.code}`} className="link">
                        {p.program.name}
                      </Link>{" "}
                      <span className="font-mono text-slate-500">({p.program.code})</span>
                    </td>
                    <td className="text-slate-700">{p.path.map((c) => c.name).join(" / ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="card divide-y divide-slate-100">
        {sections.map(([title, body]) => (
          <section key={title} className="p-4">
            <h2 className="font-semibold text-slate-800">{title}</h2>
            <p className="mt-1 whitespace-pre-line text-slate-700">{body?.trim() || "—"}</p>
          </section>
        ))}
      </div>
    </article>
  );
}
