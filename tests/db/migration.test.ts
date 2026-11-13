import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, expect, test } from "vitest";
import { db } from "@/lib/db";
import { testDatabaseUrl } from "../test-env";

// Replays the migrations against old-shape data in a throwaway schema, so the
// real test tables (and the real database) are never touched.
const SCHEMA = "migtest";
const ROOT = path.resolve(__dirname, "..", "..");
const MIGRATIONS = path.join(ROOT, "prisma", "migrations");
const PRISMA_CLI = path.join(ROOT, "node_modules", "prisma", "build", "index.js");
const SLOW = 60_000; // each step starts the Prisma CLI

function migrationFile(suffix: string): string {
  const dir = fs.readdirSync(MIGRATIONS).find((d) => d.endsWith(suffix));
  if (!dir) throw new Error(`ไม่พบ migration *${suffix}`);
  return path.join(MIGRATIONS, dir, "migration.sql");
}

function runSql(sql: string) {
  const tmp = path.join(os.tmpdir(), `migtest-${process.pid}-${Date.now()}.sql`);
  // `public` stays on the path for the pg_trgm operator classes.
  fs.writeFileSync(tmp, `SET search_path TO ${SCHEMA}, public;\n${sql}`);
  try {
    // Same as `npx prisma db execute`, without the npx start-up cost or a shell.
    execFileSync(process.execPath, [PRISMA_CLI, "db", "execute", "--url", testDatabaseUrl(), "--file", tmp], {
      stdio: "pipe",
    });
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

const dropSchema = () => db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
const q = (sql: string) => db.$queryRawUnsafe<Record<string, unknown>[]>(sql);

beforeAll(dropSchema);
afterAll(dropSchema);

test("migration ย้ายข้อมูลเดิมเข้าสาขา 31901 ครบ", async () => {
  await db.$executeRawUnsafe(`CREATE SCHEMA ${SCHEMA}`);
  runSql(fs.readFileSync(migrationFile("_init"), "utf8"));

  runSql(`
    INSERT INTO "Category" (id, code, name) VALUES (1, '1', 'หมวดหนึ่ง');
    INSERT INTO "Category" (id, code, name, "parentId") VALUES (2, '1.1', 'กลุ่ม', 1);
    INSERT INTO "Course" (code, "nameTh", "theoryHours", "practiceHours", credits, "categoryId",
                          "sourcePage", "needsReview", "reviewNote", "updatedAt")
      VALUES ('30000-1101', 'ก', 1, 2, 2, 2, 61, true, 'x', now());
    INSERT INTO "Course" (code, "nameTh", "theoryHours", "practiceHours", credits, "categoryId",
                          "editedAt", "updatedAt")
      VALUES ('30000-9999', 'ข', 0, 0, 0, 1, now(), now());
  `);

  runSql(fs.readFileSync(migrationFile("_multi_program"), "utf8"));

  const program = await q(`SELECT code, level::text AS level, name, "typeName" FROM migtest."Program"`);
  expect(program).toEqual([
    { code: "31901", level: "PVS", name: "เทคโนโลยีสารสนเทศ", typeName: "อุตสาหกรรมดิจิทัลและเทคโนโลยีสารสนเทศ" },
  ]);
  expect(await q(`SELECT code FROM migtest."Category" WHERE "programId" IS NULL`)).toEqual([]);
  expect(
    await q(`SELECT c.code, cat.code AS cat, pc."sourcePage" FROM migtest."ProgramCourse" pc
      JOIN migtest."Course" c ON c.id = pc."courseId" JOIN migtest."Category" cat ON cat.id = pc."categoryId"
      ORDER BY c.code`),
  ).toEqual([
    { code: "30000-1101", cat: "1.1", sourcePage: 61 },
    { code: "30000-9999", cat: "1", sourcePage: null },
  ]);
  expect(
    await q(`SELECT code, "sourceProgramCode", "needsReview", "reviewNote", "editedAt" IS NOT NULL AS edited
      FROM migtest."Course" ORDER BY code`),
  ).toEqual([
    { code: "30000-1101", sourceProgramCode: "31901", needsReview: true, reviewNote: "x", edited: false },
    { code: "30000-9999", sourceProgramCode: null, needsReview: false, reviewNote: null, edited: true },
  ]);
}, SLOW);

test("migration รันกับฐานว่างได้", async () => {
  await dropSchema();
  await db.$executeRawUnsafe(`CREATE SCHEMA ${SCHEMA}`);
  runSql(fs.readFileSync(migrationFile("_init"), "utf8"));
  runSql(fs.readFileSync(migrationFile("_multi_program"), "utf8"));
  expect(await q(`SELECT code FROM migtest."Program"`)).toEqual([{ code: "31901" }]);
  expect(await q(`SELECT count(*)::int AS n FROM migtest."ProgramCourse"`)).toEqual([{ n: 0 }]);
}, SLOW);
