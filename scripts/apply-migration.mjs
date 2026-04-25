// One-off migration runner for the Turso libsql dev database.
// Reads DATABASE_URL + DATABASE_AUTH_TOKEN from .env and executes SQL.
//
// Usage: node scripts/apply-migration.mjs <path-to-migration.sql>

import "dotenv/config";
import { createClient } from "@libsql/client";
import { readFile } from "node:fs/promises";

const sqlPath = process.argv[2];
if (!sqlPath) {
  console.error("Usage: node scripts/apply-migration.mjs <migration.sql>");
  process.exit(1);
}

const url = process.env.DATABASE_URL;
const authToken = process.env.DATABASE_AUTH_TOKEN;
if (!url) {
  console.error("DATABASE_URL not set.");
  process.exit(1);
}

const client = createClient({ url, authToken });
const raw = await readFile(sqlPath, "utf8");

// Strip comments, split by `;` at end of line.
const cleaned = raw
  .split("\n")
  .filter((line) => !/^\s*--/.test(line))
  .join("\n");

const statements = cleaned
  .split(/;\s*(?:\n|$)/)
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

for (const stmt of statements) {
  console.log(`\n--- Executing ---\n${stmt}\n`);
  try {
    await client.execute(stmt);
    console.log("OK");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/duplicate column name|already exists/i.test(msg)) {
      console.log("(already applied, skipping)");
      continue;
    }
    throw err;
  }
}

console.log("\nMigration applied.");
process.exit(0);
