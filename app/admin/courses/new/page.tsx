import { CourseForm } from "@/components/course-form";
import { requireRoleOrLogin } from "@/lib/authz";
import { saveCourseAction } from "../actions";
import { formPrograms } from "../form-programs";

export default async function NewCoursePage() {
  await requireRoleOrLogin("ADMIN", "STAFF");
  const programs = await formPrograms();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">เพิ่มรายวิชา</h1>
      <CourseForm
        action={saveCourseAction.bind(null, null)}
        programs={programs}
        startWithRow
        course={{
          code: "",
          nameTh: "",
          nameEn: "",
          theoryHours: null,
          practiceHours: null,
          credits: null,
          standardRef: null,
          learningOutcome: null,
          objectives: null,
          competencies: null,
          description: null,
          needsReview: false,
          reviewNote: null,
          placements: [],
        }}
      />
    </div>
  );
}
