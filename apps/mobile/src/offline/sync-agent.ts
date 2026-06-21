import { AppState, type AppStateStatus } from "react-native";

import { apiRequest } from "../api";
import { listPendingMutations, removePendingMutation } from "./queue";

let syncInFlight = false;
let syncTimer: ReturnType<typeof setInterval> | null = null;

async function replayMutation(
  mutation: { id: string; path: string; method: string; bodyJson: string | null },
  token: string,
): Promise<void> {
  await apiRequest(mutation.path, {
    method: mutation.method,
    body: mutation.bodyJson ?? undefined,
    headers: mutation.bodyJson ? { "content-type": "application/json" } : undefined,
  }, token);
  removePendingMutation(mutation.id);
}

export async function flushOfflineQueue(token: string): Promise<number> {
  if (syncInFlight) {
    return 0;
  }
  syncInFlight = true;
  let flushed = 0;
  try {
    for (const mutation of listPendingMutations()) {
      try {
        await replayMutation(mutation, token);
        flushed += 1;
      } catch {
        break;
      }
    }
  } finally {
    syncInFlight = false;
  }
  return flushed;
}

export function startOfflineSyncAgent(tokenProvider: () => string | null): () => void {
  const tick = () => {
    const token = tokenProvider();
    if (!token) {
      return;
    }
    void flushOfflineQueue(token);
  };

  syncTimer = setInterval(tick, 15_000);
  const subscription = AppState.addEventListener("change", (state: AppStateStatus) => {
    if (state === "active") {
      tick();
    }
  });
  tick();

  return () => {
    if (syncTimer) {
      clearInterval(syncTimer);
      syncTimer = null;
    }
    subscription.remove();
  };
}
