import Link from "next/link";
import type { Level } from "@prisma/client";
import { levelLabel, listPrograms } from "@/lib/programs";

export const dynamic = "force-dynamic";

const LEVELS: Level[] = ["PVC", "PVS"];

export default async function ProgramListPage() {
  const programs = await listPrograms();

  return (
    <div className="space-y-6">
      {/* ทดสอบการ deploy: พื้นหลังสีแดงเฉพาะหน้าแรก */}
      <div aria-hidden className="fixed inset-0 -z-10 bg-red-600" />
      <h1 className="text-xl font-semibold">หลักสูตร</h1>

      <form method="get" action="/search" role="search" className="card flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-0 flex-1">
          <label htmlFor="q" className="field-label">
            ค้นหา
          </label>
          <input
            id="q"
            name="q"
            type="search"
            maxLength={100}
            placeholder="ค้นหารายวิชาทุกสาขา: รหัสวิชา ชื่อวิชา หรือคำในคำอธิบาย"
            className="field"
          />
        </div>
        <button type="submit" className="btn">
          ค้นหา
        </button>
      </form>

      {programs.length === 0 && (
        <div className="card p-10 text-center text-slate-700">ยังไม่มีหลักสูตรในฐานข้อมูล</div>
      )}

      {LEVELS.map((level) => {
        const group = programs.filter((p) => p.level === level);
        if (group.length === 0) return null;
        return (
          <section key={level} className="space-y-3">
            <h2 className="text-lg font-semibold">{levelLabel(level)}</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {group.map((p) => (
                <li key={p.id}>
                  <Link href={`/p/${p.code}`} className="card block p-4 hover:border-slate-400">
                    <span className="block font-medium text-slate-900">สาขาวิชา{p.name}</span>
                    <span className="block text-sm text-slate-600">ประเภทวิชา{p.typeName}</span>
                    <span className="mt-2 block text-sm text-slate-500">
                      รหัสสาขา <span className="font-mono">{p.code}</span> · {p.courseCount} รายวิชา
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
