import * as SQLite from "expo-sqlite";

let database: SQLite.SQLiteDatabase | null = null;

export function getOfflineDatabase(): SQLite.SQLiteDatabase {
  if (!database) {
    database = SQLite.openDatabaseSync("legalbahi-offline.db");
    database.execSync(`
      CREATE TABLE IF NOT EXISTS pending_mutations (
        id TEXT PRIMARY KEY NOT NULL,
        path TEXT NOT NULL,
        method TEXT NOT NULL,
        body_json TEXT,
        created_at TEXT NOT NULL
      );
    `);
  }
  return database;
}
