import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { getCourseByCode } from "@/lib/courses";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ code: string }> };

function decode(code: string): string {
  try {
    return decodeURIComponent(code);
  } catch {
    return code; // malformed escape: treat as a literal code, which simply won't be found
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const course = await getCourseByCode(decode((await params).code));
  return { title: course ? `${course.code} ${course.nameTh}` : "ไม่พบรายวิชา" };
}

export default async function CourseDetailPage({ params }: Props) {
  const course = await getCourseByCode(decode((await params).code));
  if (!course) notFound();

  const sections: [string, string | null][] = [
    ["อ้างอิงมาตรฐาน", course.standardRef],
    ["ผลลัพธ์การเรียนรู้ระดับรายวิชา", course.learningOutcome],
    ["จุดประสงค์รายวิชา", course.objectives],
    ["สมรรถนะรายวิชา", course.competencies],
    ["คำอธิบายรายวิชา", course.description],
  ];

  return (
    <article className="space-y-5">
      <nav aria-label="เส้นทางหมวดวิชา" className="text-sm text-slate-600">
        <Link href="/" className="link">
          รายวิชา
        </Link>
        {course.path.map((p) => (
          <span key={p.code}> / {p.name}</span>
        ))}
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
