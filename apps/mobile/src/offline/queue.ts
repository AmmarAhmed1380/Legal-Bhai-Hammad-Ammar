import { getOfflineDatabase } from "./database";

export interface PendingMutation {
  id: string;
  path: string;
  method: string;
  bodyJson: string | null;
  createdAt: string;
}

function createMutationId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

export function enqueueMutation(input: {
  path: string;
  method: string;
  body?: Record<string, unknown>;
}): PendingMutation {
  const db = getOfflineDatabase();
  const record: PendingMutation = {
    id: createMutationId(),
    path: input.path,
    method: input.method,
    bodyJson: input.body ? JSON.stringify(input.body) : null,
    createdAt: new Date().toISOString(),
  };
  db.runSync(
    "INSERT INTO pending_mutations (id, path, method, body_json, created_at) VALUES (?, ?, ?, ?, ?)",
    record.id,
    record.path,
    record.method,
    record.bodyJson,
    record.createdAt,
  );
  return record;
}

export function listPendingMutations(): PendingMutation[] {
  const db = getOfflineDatabase();
  return db.getAllSync<PendingMutation>(
    "SELECT id, path, method, body_json AS bodyJson, created_at AS createdAt FROM pending_mutations ORDER BY created_at ASC",
  );
}

export function removePendingMutation(id: string): void {
  getOfflineDatabase().runSync("DELETE FROM pending_mutations WHERE id = ?", id);
}

export function pendingMutationCount(): number {
  const row = getOfflineDatabase().getFirstSync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM pending_mutations",
  );
  return row?.count ?? 0;
}
