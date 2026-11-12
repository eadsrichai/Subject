import Link from "next/link";
import { CreateUserForm, EditUserForm, PasswordForm } from "@/components/user-forms";
import { AuthzError, requireRoleOrLogin } from "@/lib/authz";
import { db } from "@/lib/db";
import { createUserAction, resetPasswordAction, updateUserAction } from "./actions";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AdminUsersPage({ searchParams }: Props) {
  try {
    await requireRoleOrLogin("ADMIN");
  } catch (err) {
    if (err instanceof AuthzError && err.reason === "FORBIDDEN") {
      return <p className="card p-6">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>;
    }
    throw err;
  }

  const editParam = (await searchParams).edit;
  const editId = typeof editParam === "string" && /^\d{1,9}$/.test(editParam) ? Number(editParam) : null;
  const users = await db.user.findMany({
    orderBy: { email: "asc" },
    select: { id: true, email: true, name: true, role: true, active: true },
  });
  const editing = users.find((u) => u.id === editId) ?? null;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">จัดการผู้ใช้</h1>

      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">อีเมล</th>
              <th scope="col">ชื่อ</th>
              <th scope="col">บทบาท</th>
              <th scope="col">สถานะ</th>
              <th scope="col">
                <span className="sr-only">การจัดการ</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{u.name}</td>
                <td>{u.role === "ADMIN" ? "ผู้ดูแลระบบ" : "เจ้าหน้าที่"}</td>
                <td className={u.active ? "" : "text-slate-500"}>{u.active ? "ใช้งานอยู่" : "ปิดการใช้งาน"}</td>
                <td className="text-right">
                  <Link href={`/admin/users?edit=${u.id}`} className="link">
                    แก้ไข
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing ? (
        <>
          <EditUserForm key={editing.id} action={updateUserAction.bind(null, editing.id)} user={editing} />
          <PasswordForm
            key={`pw-${editing.id}`}
            action={resetPasswordAction.bind(null, editing.id)}
            title={`ตั้งรหัสผ่านใหม่ให้ ${editing.email}`}
            askCurrent={false}
            submitLabel="รีเซ็ตรหัสผ่าน"
            savedMessage="ตั้งรหัสผ่านใหม่แล้ว"
          />
        </>
      ) : (
        <CreateUserForm action={createUserAction} />
      )}
    </div>
  );
}
