import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">ไม่พบหน้าที่ต้องการ</h1>
      <p className="mt-2 text-slate-600">รายวิชาหรือหน้าที่คุณเปิดอาจถูกลบหรือเปลี่ยนรหัสแล้ว</p>
      <Link href="/" className="btn mt-6">
        กลับไปหน้ารายวิชา
      </Link>
    </main>
  );
}
