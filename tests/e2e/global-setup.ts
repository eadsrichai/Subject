import { execSync } from "node:child_process";
import bcrypt from "bcryptjs";
import { loadRegistry } from "../../lib/program-registry";
import { sampleData, sampleDataPvc } from "../fixtures/sample-data";
import { testDatabaseUrl } from "../test-env";

export const TEST_PASSWORD = "password-1234";

const program = (code: string) => loadRegistry().find((p) => p.code === code)!;

export default async function globalSetup() {
  const url = testDatabaseUrl();
  process.env.DATABASE_URL = url;
  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });

  const { PrismaClient } = await import("@prisma/client");
  const { ensureAdmin, seedFromExtracted } = await import("../../lib/seed-data");
  const db = new PrismaClient({ datasourceUrl: url });
  try {
    await db.$executeRawUnsafe(
      'TRUNCATE "ProgramCourse", "Course", "Category", "Program", "User" RESTART IDENTITY CASCADE',
    );
    await seedFromExtracted(db, program("31901"), sampleData, { sortOrder: 0 });
    await seedFromExtracted(db, program("21901"), sampleDataPvc, { sortOrder: 1 });
    // A course placed in no program: found by the cross-program search only.
    await db.course.create({
      data: { code: "99999-0001", nameTh: "วิชาไร้สาขา", nameEn: "", theoryHours: 1, practiceHours: 0, credits: 1 },
    });
    await ensureAdmin(db, "admin@test.local", TEST_PASSWORD);
    await db.user.create({
      data: {
        email: "staff@test.local",
        name: "เจ้าหน้าที่ทดสอบ",
        role: "STAFF",
        passwordHash: await bcrypt.hash(TEST_PASSWORD, 10),
      },
    });
  } finally {
    await db.$disconnect();
  }
}
