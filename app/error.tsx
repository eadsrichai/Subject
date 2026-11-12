"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล</h1>
      <p className="mt-2 text-slate-600">
        กรุณาตรวจสอบว่า Docker กำลังทำงานอยู่ (<code>docker compose up -d</code>) แล้วลองใหม่
      </p>
      <button type="button" className="btn mt-6" onClick={() => reset()}>
        ลองใหม่
      </button>
    </main>
  );
}
