import { beforeEach } from "vitest";
import { testDatabaseUrl } from "../test-env";

process.env.DATABASE_URL = testDatabaseUrl();

beforeEach(async () => {
  const { db } = await import("@/lib/db");
  await db.$executeRawUnsafe(
    'TRUNCATE "ProgramCourse", "Course", "Category", "Program", "User" RESTART IDENTITY CASCADE',
  );
});
