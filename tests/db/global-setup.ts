import { execSync } from "node:child_process";
import { testDatabaseUrl } from "../test-env";

export default function setup() {
  const url = testDatabaseUrl();
  process.env.DATABASE_URL = url;
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });
}
