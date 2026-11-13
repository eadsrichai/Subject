// Loads Data/extracted/<code>.json for every program in Data/programs.json (in registry order)
// and creates the first admin.
// Usage: npx prisma db seed            (keeps rows edited on the website)
//        npx prisma db seed -- --force (overwrites them too)
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import { extractedPath, loadRegistry } from "../lib/program-registry";
import { ensureAdmin, seedFromExtracted } from "../lib/seed-data";
import type { Extracted } from "../scripts/pdf/parse";

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error("ต้องกำหนด ADMIN_EMAIL และ ADMIN_PASSWORD ใน .env");
  if (password.length < 8) throw new Error("ADMIN_PASSWORD ต้องยาวอย่างน้อย 8 ตัวอักษร");

  const programs = loadRegistry();
  const force = process.argv.includes("--force");
  const db = new PrismaClient();
  try {
    let seeded = 0;
    for (const [sortOrder, program] of programs.entries()) {
      const file = extractedPath(program.code);
      if (!fs.existsSync(file)) {
        console.log(`ข้าม ${program.code}: ยังไม่ได้ extract`);
        continue;
      }
      const data: Extracted = JSON.parse(fs.readFileSync(file, "utf8"));
      const r = await seedFromExtracted(db, program, data, { force, sortOrder });
      console.log(
        `${program.code}: เพิ่ม ${r.created}, อัปเดต ${r.updated}, ใช้ร่วม ${r.shared}, ` +
          `เติมช่องว่าง ${r.filled}, เนื้อหาไม่ตรง ${r.conflicts}, ข้าม (แก้ไขผ่านเว็บแล้ว) ${r.skipped}`,
      );
      seeded++;
    }
    if (seeded === 0) throw new Error('ไม่มีสาขาใดถูก extract — รัน "npm run extract" ก่อน');

    await ensureAdmin(db, email, password);
    console.log(`บัญชีผู้ดูแลระบบ: ${email.trim().toLowerCase()}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
