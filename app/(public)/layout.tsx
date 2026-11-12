import Link from "next/link";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="no-print border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/" className="font-semibold text-slate-900">
            ฐานข้อมูลรายวิชา ปวส. 2567
            <span className="ml-2 hidden text-sm font-normal text-slate-500 sm:inline">
              สาขาวิชาเทคโนโลยีสารสนเทศ
            </span>
          </Link>
          <nav aria-label="เมนูหลัก" className="ml-auto flex gap-5 text-sm">
            <Link href="/" className="link">
              รายวิชา
            </Link>
            <Link href="/dashboard" className="link">
              สรุปภาพรวม
            </Link>
            <Link href="/login" className="link">
              เข้าสู่ระบบ
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </>
  );
}
