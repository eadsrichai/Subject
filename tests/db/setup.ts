import { beforeEach } from "vitest";
import { testDatabaseUrl } from "../test-env";

process.env.DATABASE_URL = testDatabaseUrl();

beforeEach(async () => {
  const { db } = await import("@/lib/db");
  await db.$executeRawUnsafe(
    'TRUNCATE "Course", "Category", "User" RESTART IDENTITY CASCADE',
  );
});
