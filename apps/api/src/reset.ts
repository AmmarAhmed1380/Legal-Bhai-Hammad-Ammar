import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";

import { createStore } from "./lib/store.js";

const dbPath = process.env.DEMO_DB_PATH ?? join(process.cwd(), "data", "wakeel-demo.sqlite");
const uploadsDir = join(process.cwd(), "data", "uploads");

if (existsSync(dbPath)) {
  rmSync(dbPath, { force: true });
}

if (existsSync(uploadsDir)) {
  rmSync(uploadsDir, { recursive: true, force: true });
}

const store = createStore(dbPath);
store.close();

console.log(`Wakeel demo database reset at ${dbPath}`);
