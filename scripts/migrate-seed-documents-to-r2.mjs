/**
 * Upload built-in seed documents (seed:*) to R2 and update Postgres storage keys.
 * Run on the VPS after seed-investor-postgres with production .env loaded.
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const script = join(repoRoot, "apps", "api", "src", "migrate-seed-to-r2.ts");

const result = spawnSync(
  process.execPath,
  ["--import", "tsx", script],
  { cwd: join(repoRoot, "apps", "api"), stdio: "inherit", env: process.env },
);

process.exit(result.status ?? 1);
