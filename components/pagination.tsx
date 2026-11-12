import Link from "next/link";

type Props = { page: number; pageCount: number; hrefFor: (page: number) => string };

export function Pagination({ page, pageCount, hrefFor }: Props) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label="เลือกหน้า" className="flex items-center justify-between text-sm">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className="btn-secondary">
          ก่อนหน้า
        </Link>
      ) : (
        <span />
      )}
      <span className="text-slate-600">
        หน้า {page} จาก {pageCount}
      </span>
      {page < pageCount ? (
        <Link href={hrefFor(page + 1)} className="btn-secondary">
          ถัดไป
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
