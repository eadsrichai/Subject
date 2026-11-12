import Link from "next/link";
import { logout } from "@/app/login/actions";
import { requireRoleOrLogin } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRoleOrLogin("ADMIN", "STAFF");

  return (
    <>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 text-sm">
          <span className="font-semibold text-slate-900">ผู้ดูแลระบบรายวิชา</span>
          <nav aria-label="เมนูผู้ดูแล" className="flex flex-wrap gap-4">
            <Link href="/admin" className="link">
              ภาพรวม
            </Link>
            <Link href="/admin/courses" className="link">
              รายวิชา
            </Link>
            <Link href="/admin/categories" className="link">
              หมวดวิชา
            </Link>
            {user.role === "ADMIN" && (
              <Link href="/admin/users" className="link">
                ผู้ใช้
              </Link>
            )}
            <Link href="/admin/account" className="link">
              บัญชีของฉัน
            </Link>
            <Link href="/" className="link">
              หน้าสาธารณะ
            </Link>
          </nav>
          <form action={logout} className="ml-auto flex items-center gap-3">
            <span className="text-slate-600">
              {user.name} ({user.role === "ADMIN" ? "ผู้ดูแลระบบ" : "เจ้าหน้าที่"})
            </span>
            <button type="submit" className="btn-secondary">
              ออกจากระบบ
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </>
  );
}
