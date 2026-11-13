import Link from "next/link";
import { DeleteButton } from "@/components/form";
import { ProgramForm } from "@/components/program-form";
import { requireRoleOrLogin } from "@/lib/authz";
import { levelLabel, listPrograms } from "@/lib/programs";
import { deleteProgramAction, saveProgramAction } from "./actions";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AdminProgramsPage({ searchParams }: Props) {
  await requireRoleOrLogin("ADMIN", "STAFF");
  const editParam = (await searchParams).edit;
  const programs = await listPrograms();
  const editing = typeof editParam === "string" ? (programs.find((p) => String(p.id) === editParam) ?? null) : null;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">จัดการสาขา</h1>

      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">ระดับ</th>
              <th scope="col">รหัส</th>
              <th scope="col">ชื่อสาขา</th>
              <th scope="col">ประเภทวิชา</th>
              <th scope="col">จำนวนวิชา</th>
              <th scope="col">ลำดับ</th>
              <th scope="col">
                <span className="sr-only">การจัดการ</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {programs.map((p) => (
              <tr key={p.id}>
                <td className="whitespace-nowrap">{levelLabel(p.level)}</td>
                <td className="font-mono">{p.code}</td>
                <td>{p.name}</td>
                <td className="text-slate-600">{p.typeName}</td>
                <td>{p.courseCount}</td>
                <td>{p.sortOrder}</td>
                <td className="whitespace-nowrap text-right">
                  <Link href={`/admin/categories?program=${p.code}`} className="link mr-3">
                    หมวดวิชา
                  </Link>
                  <Link href={`/admin/programs?edit=${p.id}`} className="link mr-3">
                    แก้ไข
                  </Link>
                  <DeleteButton
                    action={deleteProgramAction.bind(null, p.id)}
                    label="ลบ"
                    confirmMessage={`ลบสาขา ${p.code} ${p.name} พร้อมหมวดวิชาทั้งหมดของสาขานี้ ใช่หรือไม่?`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ProgramForm
        key={editing?.id ?? "new"}
        action={saveProgramAction.bind(null, editing?.id ?? null)}
        program={editing}
      />
    </div>
  );
}
