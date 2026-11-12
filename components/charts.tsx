"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Categorical slots 1 and 2 of the validated default palette (colour-blind safe as a pair).
const SERIES_1 = "#2a78d6";
const SERIES_2 = "#eb6834";
const INK = "#0f172a";
const MUTED = "#64748b";
const GRID = "#e2e8f0";

const tick = { fontSize: 12, fill: MUTED };
const tooltipStyle = { fontSize: 13, borderRadius: 6, borderColor: GRID };

/** Number of courses per top-level category — magnitude, so one hue. */
export function CategoryBarChart({ data }: { data: { name: string; courses: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 44 + 30)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, bottom: 4, left: 8 }} barCategoryGap={10}>
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" allowDecimals={false} tick={tick} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" width={230} tick={{ fontSize: 12, fill: INK }} axisLine={false} tickLine={false} />
        <Tooltip cursor={{ fill: "#f1f5f9" }} contentStyle={tooltipStyle} formatter={(v) => [`${v} วิชา`, "จำนวน"]} />
        <Bar dataKey="courses" fill={SERIES_1} radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false}>
          <LabelList dataKey="courses" position="right" style={{ fontSize: 12, fill: INK }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** How many courses carry each credit value. */
export function CreditsBarChart({ data }: { data: { credits: number; courses: number }[] }) {
  const rows = data.map((d) => ({ label: `${d.credits} หน่วยกิต`, courses: d.courses }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={rows} margin={{ top: 20, right: 8, bottom: 4, left: 0 }} barCategoryGap="25%">
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="label" tick={tick} axisLine={{ stroke: GRID }} tickLine={false} />
        <YAxis allowDecimals={false} tick={tick} axisLine={false} tickLine={false} width={36} />
        <Tooltip cursor={{ fill: "#f1f5f9" }} contentStyle={tooltipStyle} formatter={(v) => [`${v} วิชา`, "จำนวน"]} />
        <Bar dataKey="courses" fill={SERIES_1} radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false}>
          <LabelList dataKey="courses" position="top" style={{ fontSize: 12, fill: INK }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Theory vs practice hours as one segmented bar — two parts of one whole. */
export function HoursBarChart({ theory, practice }: { theory: number; practice: number }) {
  const data = [{ name: "ชั่วโมงต่อสัปดาห์", theory, practice }];
  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
        <XAxis type="number" hide domain={[0, Math.max(1, theory + practice)]} />
        <YAxis type="category" dataKey="name" hide />
        <Tooltip cursor={false} contentStyle={tooltipStyle} formatter={(v, name) => [`${v} ชม.`, name]} />
        <Legend verticalAlign="bottom" iconType="square" wrapperStyle={{ fontSize: 13, color: INK }} />
        {/* The white stroke is the 2px surface gap between segments. */}
        <Bar dataKey="theory" name="ทฤษฎี" stackId="h" fill={SERIES_1} stroke="#ffffff" strokeWidth={2} radius={[4, 0, 0, 4]} isAnimationActive={false}>
          <LabelList dataKey="theory" position="center" style={{ fontSize: 13, fill: "#ffffff", fontWeight: 600 }} />
        </Bar>
        <Bar dataKey="practice" name="ปฏิบัติ" stackId="h" fill={SERIES_2} stroke="#ffffff" strokeWidth={2} radius={[0, 4, 4, 0]} isAnimationActive={false}>
          <LabelList dataKey="practice" position="center" style={{ fontSize: 13, fill: "#ffffff", fontWeight: 600 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
