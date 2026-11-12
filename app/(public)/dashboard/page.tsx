import type { Metadata } from "next";
import { CategoryBarChart, CreditsBarChart, HoursBarChart } from "@/components/charts";
import { getStats } from "@/lib/courses";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "สรุปภาพรวมรายวิชา" };

/** Total credits the curriculum requires (spec §2: "รวมไม่น้อยกว่า 80 หน่วยกิต"). */
const REQUIRED_CREDITS = 80;

export default async function DashboardPage() {
  const stats = await getStats();
  const topLevel = stats.byCategory.filter((c) => c.depth === 0);
  const totalHours = stats.hours.theory + stats.hours.practice;
  const percent = (n: number) => (totalHours === 0 ? "0" : ((n / totalHours) * 100).toFixed(0));

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">สรุปภาพรวมรายวิชา</h1>

      <dl className="grid gap-4 sm:grid-cols-3">
        <div className="card p-4">
          <dt className="text-sm text-slate-600">รายวิชาทั้งหมดในฐานข้อมูล</dt>
          <dd className="text-3xl font-semibold" data-testid="total-courses">
            {stats.totalCourses}
          </dd>
        </div>
        <div className="card p-4">
          <dt className="text-sm text-slate-600">หน่วยกิตที่ต้องเรียนตามโครงสร้าง</dt>
          <dd className="text-3xl font-semibold">
            ≥ {REQUIRED_CREDITS}
          </dd>
        </div>
        <div className="card p-4">
          <dt className="text-sm text-slate-600">หมวด/กลุ่มวิชา</dt>
          <dd className="text-3xl font-semibold">{stats.byCategory.length}</dd>
        </div>
      </dl>

      <section className="card space-y-3 p-5">
        <h2 className="font-semibold">จำนวนรายวิชาต่อหมวดวิชา</h2>
        <CategoryBarChart data={topLevel.map((c) => ({ name: c.name, courses: c.courses }))} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card space-y-3 p-5">
          <h2 className="font-semibold">จำนวนรายวิชาตามหน่วยกิต</h2>
          <CreditsBarChart data={stats.byCredits} />
          <table className="data-table" aria-label="จำนวนรายวิชาตามหน่วยกิต">
            <thead>
              <tr>
                <th scope="col">หน่วยกิต</th>
                <th scope="col">จำนวนวิชา</th>
              </tr>
            </thead>
            <tbody>
              {stats.byCredits.map((c) => (
                <tr key={c.credits}>
                  <td>{c.credits}</td>
                  <td>{c.courses}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card space-y-3 p-5">
          <h2 className="font-semibold">สัดส่วนชั่วโมงทฤษฎีและปฏิบัติ (รวมทุกรายวิชา)</h2>
          <HoursBarChart theory={stats.hours.theory} practice={stats.hours.practice} />
          <table className="data-table" aria-label="ชั่วโมงทฤษฎีและปฏิบัติ">
            <thead>
              <tr>
                <th scope="col">ประเภท</th>
                <th scope="col">ชั่วโมงต่อสัปดาห์</th>
                <th scope="col">ร้อยละ</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>ทฤษฎี</td>
                <td>{stats.hours.theory}</td>
                <td>{percent(stats.hours.theory)}</td>
              </tr>
              <tr>
                <td>ปฏิบัติ</td>
                <td>{stats.hours.practice}</td>
                <td>{percent(stats.hours.practice)}</td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>

      <section className="card space-y-3 p-5">
        <h2 className="font-semibold">โครงสร้างหลักสูตร</h2>
        <div className="overflow-x-auto">
          <table className="data-table" aria-label="โครงสร้างหลักสูตร">
            <thead>
              <tr>
                <th scope="col">รหัส</th>
                <th scope="col">หมวด/กลุ่มวิชา</th>
                <th scope="col">หน่วยกิตขั้นต่ำ</th>
                <th scope="col">จำนวนวิชา</th>
                <th scope="col">หน่วยกิตรวมของวิชาที่มี</th>
              </tr>
            </thead>
            <tbody>
              {stats.byCategory.map((c) => (
                <tr key={c.code} className={c.depth === 0 ? "font-medium" : ""}>
                  <td className="whitespace-nowrap font-mono">{c.code}</td>
                  <td style={{ paddingLeft: `${0.75 + c.depth * 1.5}rem` }}>{c.name}</td>
                  <td>{c.minCredits ?? "—"}</td>
                  <td>{c.courses}</td>
                  <td>{c.credits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
