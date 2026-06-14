import { rmSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const database = resolve(root, "data", "legalbahi-brother-test.sqlite");
const uploads = resolve(root, "data", "brother-test-uploads");

for (const path of [database, `${database}-shm`, `${database}-wal`, uploads]) {
  rmSync(path, { recursive: true, force: true });
}

console.log("LegalBahi brother-test data reset. The next start will create a clean test workspace.");
