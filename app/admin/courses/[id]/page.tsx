import Link from "next/link";
import { notFound } from "next/navigation";
import { CourseForm } from "@/components/course-form";
import { DeleteButton } from "@/components/form";
import { requireRoleOrLogin } from "@/lib/authz";
import { listCategories } from "@/lib/courses";
import { db } from "@/lib/db";
import { listPrograms } from "@/lib/programs";
import { deleteCourseAction, saveCourseAction } from "../actions";

type Props = { params: Promise<{ id: string }> };

export default async function EditCoursePage({ params }: Props) {
  await requireRoleOrLogin("ADMIN", "STAFF");
  const { id: rawId } = await params;
  if (!/^\d{1,9}$/.test(rawId)) notFound();
  const id = Number(rawId);
  // Temporary until the placements field: the course's place in the first program only.
  const program = (await listPrograms())[0];
  const [found, categories] = await Promise.all([
    db.course.findUnique({ where: { id }, include: { placements: true } }),
    program ? listCategories(program.id) : [],
  ]);
  if (!found) notFound();
  const { placements, ...course } = found;
  const placement = placements.find((p) => p.programId === program?.id);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">
          แก้ไขรายวิชา <span className="font-mono">{course.code}</span>
        </h1>
        <div className="flex items-center gap-3">
          <Link href={`/courses/${encodeURIComponent(course.code)}`} className="link text-sm">
            ดูหน้าสาธารณะ
          </Link>
          <DeleteButton
            action={deleteCourseAction.bind(null, id)}
            label="ลบรายวิชา"
            confirmMessage={`ลบรายวิชา ${course.code} ${course.nameTh} ใช่หรือไม่? การลบไม่สามารถย้อนกลับได้`}
          />
        </div>
      </div>
      <CourseForm
        action={saveCourseAction.bind(null, id)}
        categories={categories}
        course={{ ...course, categoryId: placement?.categoryId ?? null, sourcePage: placement?.sourcePage ?? null }}
      />
    </div>
  );
}
