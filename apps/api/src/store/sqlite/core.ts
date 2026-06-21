import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

import type {
  AuditEvent,
  Hearing,
  Matter,
  Message,
  MessageThread,
  ProductDocument,
  ProductSession,
  ProductUser,
} from "@wakeel/shared";

import type { MatterDetail, ProductClientSummary, StoredDocumentRow } from "../types.js";
import { decodeJson, encodeJson, nowIso } from "../utils.js";

export interface SqliteStoreCore {
  db: DatabaseSync;
  listMatters(session: ProductSession): Matter[];
  listHearings(session: ProductSession, matterId: string): Hearing[];
  getMatter(session: ProductSession, matterId: string): MatterDetail | null;
  listDocuments(session: ProductSession, filters?: { matterId?: string }): ProductDocument[];
  getDocument(session: ProductSession, id: string): ProductDocument | null;
  listThreads(session: ProductSession): Array<MessageThread & { matter: Matter; lastMessage: Message | null }>;
  listClients(session: ProductSession): ProductClientSummary[];
  canAccessMatter(session: ProductSession, matterId: string, firmId: string): boolean;
  canAccessDocument(session: ProductSession, document: ProductDocument): boolean;
  getMatterFirmId(matterId: string): string | null;
  staffBelongsToFirm(userId: string, firmId: string): boolean;
  clientBelongsToFirm(clientAccountId: string, firmId: string): boolean;
  getStaffUser(id: string): ProductUser | null;
  synchronizeManualCalendarItem(matterId: string, nextHearingAt: string | null): void;
  markPossibleCalendarConflicts(listDate: string): void;
  createAuditEvent(input: Omit<AuditEvent, "id" | "createdAt">): void;
  enqueueMatterClientUpdate(firmId: string, hearing: Hearing): void;
  enqueueNotification(
    firmId: string,
    actorType: "staff" | "client",
    actorId: string,
    channel: "email" | "sms",
    templateKey: string,
    payload: Record<string, unknown>,
    scheduledAt: string,
    idempotencyKey: string,
  ): boolean;
}

export const coreMethods: Pick<
  SqliteStoreCore,
  | "canAccessMatter"
  | "canAccessDocument"
  | "getMatterFirmId"
  | "staffBelongsToFirm"
  | "clientBelongsToFirm"
  | "getStaffUser"
  | "markPossibleCalendarConflicts"
  | "synchronizeManualCalendarItem"
  | "createAuditEvent"
  | "enqueueMatterClientUpdate"
  | "enqueueNotification"
  | "listDocuments"
  | "getDocument"
  | "listThreads"
> = {
  getStaffUser(this: SqliteStoreCore, id: string): ProductUser | null {
    const row = this.db
      .prepare("SELECT id, phone, email, display_name AS displayName, language, status FROM product_users WHERE id = ?")
      .get(id) as ProductUser | undefined;
    return row ?? null;
  },

  getMatterFirmId(this: SqliteStoreCore, matterId: string): string | null {
    const row = this.db.prepare("SELECT firm_id AS firmId FROM matters WHERE id = ?").get(matterId) as { firmId: string } | undefined;
    return row?.firmId ?? null;
  },

  staffBelongsToFirm(this: SqliteStoreCore, userId: string, firmId: string): boolean {
    const row = this.db
      .prepare("SELECT id FROM firm_memberships WHERE user_id = ? AND firm_id = ?")
      .get(userId, firmId) as { id: string } | undefined;
    return Boolean(row);
  },

  clientBelongsToFirm(this: SqliteStoreCore, clientAccountId: string, firmId: string): boolean {
    const row = this.db
      .prepare(`
        SELECT cm.id
        FROM client_memberships cm
        JOIN matters m ON m.id = cm.matter_id
        WHERE cm.client_account_id = ? AND m.firm_id = ?
        LIMIT 1
      `)
      .get(clientAccountId, firmId) as { id: string } | undefined;
    return Boolean(row);
  },

  canAccessMatter(this: SqliteStoreCore, session: ProductSession, matterId: string, firmId: string): boolean {
    if (session.actorType === "staff") {
      return session.firmId === firmId;
    }

    const membership = this.db
      .prepare("SELECT id FROM client_memberships WHERE client_account_id = ? AND matter_id = ?")
      .get(session.actorId, matterId) as { id: string } | undefined;
    return Boolean(membership);
  },

  canAccessDocument(this: SqliteStoreCore, session: ProductSession, document: ProductDocument): boolean {
    if (session.actorType === "staff") {
      return session.firmId === document.firmId;
    }
    if (!document.matterId) {
      return false;
    }
    return document.portalVisible && this.canAccessMatter(session, document.matterId, document.firmId);
  },

  markPossibleCalendarConflicts(this: SqliteStoreCore, listDate: string): void {
    const normalizedDate = listDate.slice(0, 10);
    const rows = this.db
      .prepare(`
        SELECT ci.id, ci.matter_id AS matterId, m.lead_lawyer_id AS leadLawyerId, m.court_id AS courtId
        FROM calendar_items ci JOIN matters m ON m.id = ci.matter_id
        WHERE substr(ci.listed_at, 1, 10) = ?
      `)
      .all(normalizedDate) as Array<{ id: string; matterId: string; leadLawyerId: string | null; courtId: string }>;
    this.db.prepare("UPDATE calendar_items SET conflict_state = 'none' WHERE substr(listed_at, 1, 10) = ?").run(normalizedDate);
    for (const row of rows) {
      const hasConflict =
        row.leadLawyerId &&
        rows.some(
          (candidate) =>
            candidate.matterId !== row.matterId &&
            candidate.leadLawyerId === row.leadLawyerId &&
            candidate.courtId !== row.courtId,
        );
      if (hasConflict) {
        this.db.prepare("UPDATE calendar_items SET conflict_state = 'possible' WHERE id = ?").run(row.id);
      }
    }
  },

  synchronizeManualCalendarItem(this: SqliteStoreCore, matterId: string, nextHearingAt: string | null): void {
    const existingDates = (
      this.db
        .prepare("SELECT listed_at AS listedAt FROM calendar_items WHERE matter_id = ?")
        .all(matterId) as Array<{ listedAt: string }>
    ).map((row) => row.listedAt.slice(0, 10));
    this.db.prepare("DELETE FROM calendar_items WHERE matter_id = ? AND source_type = 'manual_staff'").run(matterId);
    if (nextHearingAt) {
      this.db
        .prepare(`
          INSERT INTO calendar_items (id, matter_id, listed_at, courtroom, bench, source_type, source_confidence, conflict_state, created_at)
          VALUES (?, ?, ?, NULL, NULL, 'manual_staff', 1, 'none', ?)
        `)
        .run(randomUUID(), matterId, nextHearingAt, nowIso());
    }
    for (const date of new Set([...existingDates, ...(nextHearingAt ? [nextHearingAt.slice(0, 10)] : [])])) {
      this.markPossibleCalendarConflicts(date);
    }
  },

  createAuditEvent(this: SqliteStoreCore, input: Omit<AuditEvent, "id" | "createdAt">): void {
    this.db
      .prepare(`
        INSERT INTO audit_events (id, firm_id, actor_type, actor_id, object_type, object_id, event_type, payload_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        randomUUID(),
        input.firmId,
        input.actorType,
        input.actorId,
        input.objectType,
        input.objectId,
        input.eventType,
        encodeJson(input.payload),
        nowIso(),
      );
  },

  enqueueNotification(
    this: SqliteStoreCore,
    firmId: string,
    actorType: "staff" | "client",
    actorId: string,
    channel: "email" | "sms",
    templateKey: string,
    payload: Record<string, unknown>,
    scheduledAt: string,
    idempotencyKey: string,
  ): boolean {
    const consent = this.db
      .prepare(`
        SELECT 1
        FROM notification_consents
        WHERE firm_id = ? AND actor_type = ? AND actor_id = ? AND channel = ?
          AND status = 'granted' AND revoked_at IS NULL
      `)
      .get(firmId, actorType, actorId, channel);
    if (!consent) {
      return false;
    }
    const preference = this.db
      .prepare(
        "SELECT email_enabled AS emailEnabled, sms_enabled AS smsEnabled, opted_out_at AS optedOutAt FROM notification_preferences WHERE firm_id = ? AND actor_type = ? AND actor_id = ?",
      )
      .get(firmId, actorType, actorId) as { emailEnabled: number; smsEnabled: number; optedOutAt: string | null } | undefined;
    if (
      preference?.optedOutAt ||
      (channel === "email" && preference?.emailEnabled === 0) ||
      (channel === "sms" && preference?.smsEnabled === 0)
    ) {
      return false;
    }
    const result = this.db
      .prepare(`
        INSERT OR IGNORE INTO notification_jobs (
          id, firm_id, actor_type, actor_id, channel, template_key, template_version, payload_json, idempotency_key, scheduled_at, status, attempt_count, last_error, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 'pending', 0, NULL, ?)
      `)
      .run(randomUUID(), firmId, actorType, actorId, channel, templateKey, encodeJson(payload), idempotencyKey, scheduledAt, nowIso());
    return Number(result.changes ?? 0) > 0;
  },

  enqueueMatterClientUpdate(this: SqliteStoreCore, firmId: string, hearing: Hearing): void {
    const clients = this.db
      .prepare(`
        SELECT cm.client_account_id AS clientId
        FROM client_memberships cm
        JOIN client_accounts c ON c.id = cm.client_account_id
        WHERE cm.matter_id = ? AND c.status = 'active'
      `)
      .all(hearing.matterId) as Array<{ clientId: string }>;
    for (const client of clients) {
      this.enqueueNotification(
        firmId,
        "client",
        client.clientId,
        "sms",
        "post_hearing_update",
        { matterId: hearing.matterId, outcome: hearing.outcome, notes: hearing.notes, nextDate: hearing.nextDate },
        nowIso(),
        `post-hearing:${hearing.id}:${client.clientId}:sms`,
      );
    }
  },

  listDocuments(this: SqliteStoreCore, session: ProductSession, filters: { matterId?: string } = {}): ProductDocument[] {
    const rows = this.db
      .prepare(`
        SELECT
          id,
          firm_id AS firmId,
          matter_id AS matterId,
          folder_id AS folderId,
          type,
          title,
          storage_key AS storageKey,
          mime_type AS mimeType,
          uploaded_by AS uploadedBy,
          ocr_status AS ocrStatus,
          ocr_text AS ocrText,
          search_text AS searchText,
          portal_visible AS portalVisible
        FROM documents
        WHERE (? IS NULL OR matter_id = ?)
        ORDER BY created_at DESC
      `)
      .all(filters.matterId ?? null, filters.matterId ?? null)
      .map((row) => ({
        ...(row as unknown as ProductDocument),
        portalVisible: Boolean((row as { portalVisible: number }).portalVisible),
      })) as ProductDocument[];

    return rows.filter((document) => this.canAccessDocument(session, document));
  },

  getDocument(this: SqliteStoreCore, session: ProductSession, id: string): ProductDocument | null {
    const row = this.db
      .prepare(`
        SELECT
          id,
          firm_id AS firmId,
          matter_id AS matterId,
          folder_id AS folderId,
          type,
          title,
          storage_key AS storageKey,
          mime_type AS mimeType,
          uploaded_by AS uploadedBy,
          ocr_status AS ocrStatus,
          ocr_text AS ocrText,
          search_text AS searchText,
          portal_visible AS portalVisible
        FROM documents
        WHERE id = ?
      `)
      .get(id) as StoredDocumentRow | undefined;
    if (!row) {
      return null;
    }
    const document = { ...row, portalVisible: Boolean(row.portalVisible) };
    if (!this.canAccessDocument(session, document)) {
      return null;
    }
    return document;
  },

  listThreads(this: SqliteStoreCore, session: ProductSession): Array<MessageThread & { matter: Matter; lastMessage: Message | null }> {
    return this.listMatters(session)
      .map((matter) => {
        const thread = this.db
          .prepare("SELECT id, matter_id AS matterId, participant_type AS participantType, status FROM message_threads WHERE matter_id = ?")
          .get(matter.id) as MessageThread | undefined;
        if (!thread) {
          return null;
        }
        const lastMessage = this.db
          .prepare(`
          SELECT id, thread_id AS threadId, sender_type AS senderType, sender_id AS senderId, body, language, delivery_channel AS deliveryChannel, delivery_state AS deliveryState, created_at AS createdAt
          FROM messages
          WHERE thread_id = ?
          ORDER BY created_at DESC
          LIMIT 1
        `)
          .get(thread.id) as Message | undefined;

        return {
          ...thread,
          matter,
          lastMessage: lastMessage ?? null,
        };
      })
      .filter(Boolean) as Array<MessageThread & { matter: Matter; lastMessage: Message | null }>;
  },
};
