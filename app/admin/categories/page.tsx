import Link from "next/link";
import { notFound } from "next/navigation";
import { CategoryForm } from "@/components/category-form";
import { DeleteButton } from "@/components/form";
import { requireRoleOrLogin } from "@/lib/authz";
import { listCategories } from "@/lib/courses";
import { db } from "@/lib/db";
import { listPrograms } from "@/lib/programs";
import { deleteCategoryAction, saveCategoryAction } from "./actions";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AdminCategoriesPage({ searchParams }: Props) {
  await requireRoleOrLogin("ADMIN", "STAFF");
  const editParam = (await searchParams).edit;
  const editId = typeof editParam === "string" && /^\d{1,9}$/.test(editParam) ? Number(editParam) : null;

  // Temporary until the program picker: the first program is the current one.
  const program = (await listPrograms())[0];
  if (!program) notFound();
  const categories = await listCategories(program.id);
  const editing = editId === null ? null : await db.category.findFirst({ where: { id: editId, programId: program.id } });

  // A category cannot be moved under itself or its own descendants.
  const start = editing ? categories.findIndex((c) => c.id === editing.id) : -1;
  const excluded = new Set<number>();
  if (start !== -1) {
    excluded.add(categories[start].id);
    for (let i = start + 1; i < categories.length && categories[i].depth > categories[start].depth; i++) {
      excluded.add(categories[i].id);
    }
  }
  const parents = categories.filter((c) => !excluded.has(c.id));

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">จัดการหมวดวิชา</h1>

      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">รหัส</th>
              <th scope="col">ชื่อหมวด/กลุ่ม</th>
              <th scope="col">หน่วยกิตขั้นต่ำ</th>
              <th scope="col">จำนวนวิชา</th>
              <th scope="col">
                <span className="sr-only">การจัดการ</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id}>
                <td className="whitespace-nowrap font-mono">{c.code}</td>
                <td style={{ paddingLeft: `${0.75 + c.depth * 1.5}rem` }}>{c.name}</td>
                <td>{c.minCredits ?? "—"}</td>
                <td>{c.courseCount}</td>
                <td className="whitespace-nowrap text-right">
                  <Link href={`/admin/categories?edit=${c.id}`} className="link mr-3">
                    แก้ไข
                  </Link>
                  <DeleteButton
                    action={deleteCategoryAction.bind(null, c.id)}
                    label="ลบ"
                    confirmMessage={`ลบหมวด ${c.code} ${c.name} ใช่หรือไม่?`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CategoryForm
        key={editing?.id ?? "new"}
        action={saveCategoryAction.bind(null, editing?.id ?? null)}
        programId={program.id}
        category={editing}
        parents={parents}
      />
    </div>
  );
}
