import { CourseForm } from "@/components/course-form";
import { requireRoleOrLogin } from "@/lib/authz";
import { listCategories } from "@/lib/courses";
import { saveCourseAction } from "../actions";

export default async function NewCoursePage() {
  await requireRoleOrLogin("ADMIN", "STAFF");
  const categories = await listCategories();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">เพิ่มรายวิชา</h1>
      <CourseForm
        action={saveCourseAction.bind(null, null)}
        categories={categories}
        course={{
          code: "",
          nameTh: "",
          nameEn: "",
          theoryHours: null,
          practiceHours: null,
          credits: null,
          categoryId: null,
          standardRef: null,
          learningOutcome: null,
          objectives: null,
          competencies: null,
          description: null,
          needsReview: false,
          reviewNote: null,
          sourcePage: null,
        }}
      />
    </div>
  );
}
