import type { Level } from "@prisma/client";
import Link from "next/link";
import { levelLabel } from "@/lib/programs";

type Props = { program?: { code: string; level: Level; name: string } };

/** The public header; inside a program it names the program and links to its dashboard. */
export function SiteHeader({ program }: Props) {
  return (
    <header className="no-print border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <div>
          <Link href="/" className="font-semibold text-slate-900">
            ฐานข้อมูลรายวิชา หลักสูตร 2567
          </Link>
          {program && (
            <Link href={`/p/${program.code}`} className="block text-sm text-slate-600 hover:underline">
              {levelLabel(program.level)} สาขาวิชา{program.name}
            </Link>
          )}
        </div>
        <nav aria-label="เมนูหลัก" className="ml-auto flex gap-5 text-sm">
          <Link href="/" className="link">
            หลักสูตร
          </Link>
          {program && (
            <>
              <Link href={`/p/${program.code}`} className="link">
                รายวิชา
              </Link>
              <Link href={`/p/${program.code}/dashboard`} className="link">
                สรุปภาพรวม
              </Link>
            </>
          )}
          <Link href="/login" className="link">
            เข้าสู่ระบบ
          </Link>
        </nav>
      </div>
    </header>
  );
}
