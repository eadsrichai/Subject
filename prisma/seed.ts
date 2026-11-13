// Loads Data/extracted/courses.json into the database and creates the first admin.
// Usage: npx prisma db seed            (keeps courses edited on the website)
//        npx prisma db seed -- --force (overwrites them too)
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import type { ProgramEntry } from "../lib/program-registry";
import { ensureAdmin, seedFromExtracted } from "../lib/seed-data";
import type { Extracted } from "../scripts/pdf/parse";

const DATA_FILE = "Data/extracted/courses.json";

// The only program for now; the registry file (Data/programs.json) replaces this.
const PROGRAM: ProgramEntry = {
  code: "31901",
  level: "PVS",
  name: "เทคโนโลยีสารสนเทศ",
  typeName: "อุตสาหกรรมดิจิทัลและเทคโนโลยีสารสนเทศ",
  pdf: "31901v7_18_10_68.pdf",
  pages: [37, 106],
};

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error("ต้องกำหนด ADMIN_EMAIL และ ADMIN_PASSWORD ใน .env");
  if (password.length < 8) throw new Error("ADMIN_PASSWORD ต้องยาวอย่างน้อย 8 ตัวอักษร");
  if (!fs.existsSync(DATA_FILE)) throw new Error(`ไม่พบ ${DATA_FILE} — รัน "npm run extract" ก่อน`);

  const data: Extracted = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  const db = new PrismaClient();
  try {
    const force = process.argv.includes("--force");
    const r = await seedFromExtracted(db, PROGRAM, data, { force });
    console.log(`รายวิชา: เพิ่ม ${r.created}, อัปเดต ${r.updated}, ข้าม (แก้ไขผ่านเว็บแล้ว) ${r.skipped}`);
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
