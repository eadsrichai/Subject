import fs from "node:fs";
import path from "node:path";

// Reads TEST_DATABASE_URL from the environment or .env, so tests never
// touch the real `courses` database.
export function testDatabaseUrl(): string {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  const envFile = path.resolve(__dirname, "..", ".env");
  if (fs.existsSync(envFile)) {
    const m = fs.readFileSync(envFile, "utf8").match(/^TEST_DATABASE_URL="?([^"\r\n]+)"?/m);
    if (m) return m[1];
  }
  throw new Error("TEST_DATABASE_URL is not set (see .env.example)");
}
