import Link from "next/link";
import { requireRoleOrLogin } from "@/lib/authz";
import { db } from "@/lib/db";

export default async function AdminHomePage() {
  const user = await requireRoleOrLogin("ADMIN", "STAFF");
  const [courses, categories, flagged] = await Promise.all([
    db.course.count(),
    db.category.count(),
    db.course.findMany({
      where: { needsReview: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, nameTh: true, reviewNote: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">ภาพรวม</h1>
        <p className="text-sm text-slate-600">ยินดีต้อนรับ {user.name}</p>
      </div>

      <dl className="grid gap-4 sm:grid-cols-3">
        {[
          ["รายวิชาทั้งหมด", courses],
          ["หมวด/กลุ่มวิชา", categories],
          ["ต้องตรวจสอบ", flagged.length],
        ].map(([label, n]) => (
          <div key={label} className="card p-4">
            <dt className="text-sm text-slate-600">{label}</dt>
            <dd className="text-3xl font-semibold">{n}</dd>
          </div>
        ))}
      </dl>

      <section className="space-y-2">
        <h2 className="font-semibold">รายวิชาที่ต้องตรวจสอบ</h2>
        {flagged.length === 0 ? (
          <p className="card p-4 text-sm text-slate-600">ไม่มีรายวิชาที่ต้องตรวจสอบ</p>
        ) : (
          <div className="card overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">รหัสวิชา</th>
                  <th scope="col">ชื่อวิชา</th>
                  <th scope="col">เหตุผล</th>
                </tr>
              </thead>
              <tbody>
                {flagged.map((c) => (
                  <tr key={c.id}>
                    <td className="whitespace-nowrap font-mono">
                      <Link href={`/admin/courses/${c.id}`} className="link">
                        {c.code}
                      </Link>
                    </td>
                    <td>{c.nameTh}</td>
                    <td className="text-slate-600">{c.reviewNote ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
