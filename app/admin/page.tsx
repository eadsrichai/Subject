import { requireRoleOrLogin } from "@/lib/authz";

export default async function AdminHomePage() {
  const user = await requireRoleOrLogin("ADMIN", "STAFF");
  return <h1 className="text-xl font-semibold">ยินดีต้อนรับ {user.name}</h1>;
}
