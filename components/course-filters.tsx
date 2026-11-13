"use client";

import type { CourseFilter } from "@/lib/course-filter";

type Props = {
  action: string;
  filter: CourseFilter;
  /** Omit for a cross-program list, which has no category filter. */
  categories?: { id: number; code: string; name: string; depth: number; courseCount: number }[];
  creditValues: number[];
  /** Admin list only: adds the "needs review" checkbox. */
  reviewOnly?: boolean;
};

/** A plain GET form: the query string is the only state, so links and reloads keep the filter. */
export function CourseFilters({ action, filter, categories, creditValues, reviewOnly }: Props) {
  const submit = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) =>
    e.currentTarget.form?.requestSubmit();

  return (
    <form
      method="get"
      action={action}
      role="search"
      className={`card grid gap-3 p-4 sm:items-end ${
        categories ? "sm:grid-cols-[2fr_2fr_1fr_auto]" : "sm:grid-cols-[4fr_1fr_auto]"
      }`}
    >
      <div>
        <label htmlFor="q" className="field-label">
          ค้นหา
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={filter.q}
          maxLength={100}
          placeholder="รหัสวิชา ชื่อวิชา หรือคำในคำอธิบาย"
          className="field"
        />
      </div>
      {categories && (
      <div>
        <label htmlFor="category" className="field-label">
          หมวดวิชา
        </label>
        <select id="category" name="category" defaultValue={filter.categoryId ?? ""} onChange={submit} className="field">
          <option value="">ทุกหมวด</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {"  ".repeat(c.depth)}
              {c.code} {c.name} ({c.courseCount})
            </option>
          ))}
        </select>
      </div>
      )}
      <div>
        <label htmlFor="credits" className="field-label">
          หน่วยกิต
        </label>
        <select id="credits" name="credits" defaultValue={filter.credits ?? ""} onChange={submit} className="field">
          <option value="">ทั้งหมด</option>
          {creditValues.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className="btn">
        ค้นหา
      </button>
      {reviewOnly !== undefined && (
        <label className="flex items-center gap-2 text-sm sm:col-span-4">
          <input type="checkbox" name="review" value="1" defaultChecked={reviewOnly} onChange={submit} />
          เฉพาะที่ต้องตรวจสอบ
        </label>
      )}
    </form>
  );
}
