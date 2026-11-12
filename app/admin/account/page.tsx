import { PasswordForm } from "@/components/user-forms";
import { requireRoleOrLogin } from "@/lib/authz";
import { changePasswordAction } from "./actions";

export default async function AccountPage() {
  const user = await requireRoleOrLogin("ADMIN", "STAFF");
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">บัญชีของฉัน</h1>
        <p className="text-sm text-slate-600">
          {user.name} · {user.email} · {user.role === "ADMIN" ? "ผู้ดูแลระบบ" : "เจ้าหน้าที่"}
        </p>
      </div>
      <PasswordForm
        action={changePasswordAction}
        title="เปลี่ยนรหัสผ่าน"
        askCurrent
        submitLabel="เปลี่ยนรหัสผ่าน"
        savedMessage="เปลี่ยนรหัสผ่านแล้ว"
      />
    </div>
  );
}
