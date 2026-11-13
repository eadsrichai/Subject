"use client";

import type { Level } from "@prisma/client";
import { useState } from "react";
import { FieldError } from "./form";

export type PlacementProgram = {
  id: number;
  code: string;
  level: Level;
  name: string;
  categories: { id: number; code: string; name: string; depth: number }[];
};

type Row = { key: number; programId: string; categoryId: string };

type Props = {
  programs: PlacementProgram[];
  initial: { programId: string | number; categoryId: string | number | null }[];
  errors: Record<string, string>;
};

const levelLabel = (level: Level) => (level === "PVC" ? "ปวช." : "ปวส.");

/**
 * The course form's "อยู่ในหลักสูตร" rows: one program and one of its categories per row.
 * Submitted as `placements.<i>.programId` / `placements.<i>.categoryId`; the server re-checks everything.
 */
export function PlacementsField({ programs, initial, errors }: Props) {
  const [rows, setRows] = useState<Row[]>(() =>
    initial.map((r, key) => ({ key, programId: String(r.programId ?? ""), categoryId: String(r.categoryId ?? "") })),
  );
  const [nextKey, setNextKey] = useState(initial.length);

  const update = (key: number, change: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...change } : r)));
  const add = () => {
    const used = new Set(rows.map((r) => r.programId));
    const free = programs.find((p) => !used.has(String(p.id)));
    setRows((rs) => [...rs, { key: nextKey, programId: free ? String(free.id) : "", categoryId: "" }]);
    setNextKey((k) => k + 1);
  };

  return (
    <fieldset className="space-y-2">
      <legend className="field-label">อยู่ในหลักสูตร</legend>
      {rows.length === 0 && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          วิชานี้จะไม่แสดงในหน้ารายวิชาของสาขาใด
        </p>
      )}
      {rows.map((row, i) => {
        const program = programs.find((p) => String(p.id) === row.programId);
        const n = i + 1;
        return (
          <div key={row.key} className="grid gap-2 sm:grid-cols-[16rem_1fr_auto] sm:items-start">
            <div>
              <select
                name={`placements.${i}.programId`}
                aria-label={`สาขา (แถว ${n})`}
                value={row.programId}
                onChange={(e) => update(row.key, { programId: e.target.value, categoryId: "" })}
                aria-invalid={!!errors[`placements.${i}.programId`]}
                className="field"
              >
                <option value="">— เลือกสาขา —</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {levelLabel(p.level)} {p.name} ({p.code})
                  </option>
                ))}
              </select>
              <FieldError message={errors[`placements.${i}.programId`]} />
            </div>
            <div>
              <select
                name={`placements.${i}.categoryId`}
                aria-label={`หมวด/กลุ่มวิชา (แถว ${n})`}
                value={row.categoryId}
                onChange={(e) => update(row.key, { categoryId: e.target.value })}
                aria-invalid={!!errors[`placements.${i}.categoryId`]}
                className="field"
              >
                <option value="">— เลือกหมวดวิชา —</option>
                {(program?.categories ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {"  ".repeat(c.depth)}
                    {c.code} {c.name}
                  </option>
                ))}
              </select>
              <FieldError message={errors[`placements.${i}.categoryId`]} />
            </div>
            <button
              type="button"
              className="btn-secondary"
              aria-label={`ลบแถวสาขา ${n}`}
              onClick={() => setRows((rs) => rs.filter((r) => r.key !== row.key))}
            >
              ลบ
            </button>
          </div>
        );
      })}
      {rows.length < programs.length && (
        <button type="button" className="btn-secondary" onClick={add}>
          + เพิ่มสาขา
        </button>
      )}
    </fieldset>
  );
}
