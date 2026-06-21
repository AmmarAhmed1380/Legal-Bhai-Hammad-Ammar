import { randomUUID } from "node:crypto";

import type { ClientAccount, ClientMembership, Invoice, Matter, ProductLanguage, ProductSession } from "@wakeel/shared";

import { normalizePakistanPhone } from "../../lib/validation.js";

import type { MatterDetail, ProductClientDetail, ProductClientSummary } from "../types.js";
import { nowIso } from "../utils.js";
import type { SqliteStoreCore } from "./core.js";
import { matterMethods } from "./matters.js";

export const clientMethods = {
  listClients(this: SqliteStoreCore, session: ProductSession): ProductClientSummary[] {
    if (session.actorType !== "staff" || !session.firmId) {
      return [];
    }

    return this.db
      .prepare(`
        SELECT
          c.id,
          c.phone,
          c.display_name AS displayName,
          c.language,
          c.status,
          (
            SELECT COUNT(DISTINCT cm.matter_id)
            FROM client_memberships cm
            JOIN matters m ON m.id = cm.matter_id
            WHERE cm.client_account_id = c.id AND m.firm_id = ?
          ) AS matterCount,
          (
            SELECT COALESCE(SUM(i.total), 0)
            FROM invoices i
            WHERE i.client_account_id = c.id AND i.firm_id = ? AND i.status IN ('draft', 'issued')
          ) AS outstandingTotal,
          (
            SELECT MAX(msg.created_at)
            FROM messages msg
            JOIN message_threads mt ON mt.id = msg.thread_id
            JOIN client_memberships cm ON cm.matter_id = mt.matter_id
            JOIN matters m ON m.id = cm.matter_id
            WHERE cm.client_account_id = c.id AND m.firm_id = ?
          ) AS lastMessageAt,
          (
            SELECT MIN(m.next_hearing_at)
            FROM client_memberships cm
            JOIN matters m ON m.id = cm.matter_id
            WHERE cm.client_account_id = c.id AND m.firm_id = ? AND m.next_hearing_at IS NOT NULL
          ) AS nextHearingAt
        FROM client_accounts c
        WHERE c.firm_id = ? OR EXISTS (
          SELECT 1
          FROM client_memberships cm
          JOIN matters m ON m.id = cm.matter_id
          WHERE cm.client_account_id = c.id AND m.firm_id = ?
        )
        ORDER BY c.display_name ASC
      `)
      .all(session.firmId, session.firmId, session.firmId, session.firmId, session.firmId, session.firmId) as unknown as ProductClientSummary[];
  },

  createClient(
    this: SqliteStoreCore,
    session: ProductSession,
    input: { phone: string; displayName: string; language: ProductLanguage },
  ): ClientAccount | null {
    if (session.actorType !== "staff" || !session.firmId) {
      return null;
    }
    const phone = normalizePakistanPhone(input.phone);
    if (!phone || !input.displayName.trim()) {
      return null;
    }
    const existing = this.db
      .prepare("SELECT id, phone, display_name AS displayName, language, status FROM client_accounts WHERE firm_id = ? AND phone = ?")
      .get(session.firmId, phone) as ClientAccount | undefined;
    if (existing) {
      return existing;
    }
    const client: ClientAccount = {
      id: randomUUID(),
      phone,
      displayName: input.displayName.trim(),
      language: input.language,
      status: "active",
    };
    this.db
      .prepare(
        "INSERT INTO client_accounts (id, phone, display_name, language, status, created_at, firm_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(client.id, client.phone, client.displayName, client.language, client.status, nowIso(), session.firmId);
    return client;
  },

  updateClient(
    this: SqliteStoreCore,
    session: ProductSession,
    clientId: string,
    patch: Partial<Pick<ClientAccount, "displayName" | "language" | "status">>,
  ): ClientAccount | null {
    if (session.actorType !== "staff" || !session.firmId) {
      return null;
    }
    const existing = this.db
      .prepare("SELECT id, phone, display_name AS displayName, language, status, firm_id AS firmId FROM client_accounts WHERE id = ?")
      .get(clientId) as (ClientAccount & { firmId: string | null }) | undefined;
    if (!existing || (existing.firmId !== session.firmId && !this.clientBelongsToFirm(clientId, session.firmId))) {
      return null;
    }
    const client: ClientAccount = {
      id: existing.id,
      phone: existing.phone,
      displayName: patch.displayName?.trim() || existing.displayName,
      language: patch.language ?? existing.language,
      status: patch.status ?? existing.status,
    };
    this.db
      .prepare("UPDATE client_accounts SET display_name = ?, language = ?, status = ?, firm_id = COALESCE(firm_id, ?) WHERE id = ?")
      .run(client.displayName, client.language, client.status, session.firmId, client.id);
    if (patch.status === "archived") {
      const revokedAt = nowIso();
      this.db.prepare("UPDATE portal_links SET revoked_at = ? WHERE client_account_id = ? AND revoked_at IS NULL").run(revokedAt, clientId);
      this.db.prepare("UPDATE app_sessions SET revoked_at = ? WHERE actor_type = 'client' AND actor_id = ? AND revoked_at IS NULL").run(revokedAt, clientId);
      this.db
        .prepare("DELETE FROM notification_jobs WHERE firm_id = ? AND actor_type = 'client' AND actor_id = ? AND status IN ('pending', 'retrying')")
        .run(session.firmId, clientId);
      this.db
        .prepare(
          "UPDATE notification_consents SET status = 'revoked', revoked_at = ?, updated_at = ? WHERE firm_id = ? AND actor_type = 'client' AND actor_id = ? AND status = 'granted'",
        )
        .run(revokedAt, revokedAt, session.firmId, clientId);
      this.db
        .prepare(
          "UPDATE notification_preferences SET email_enabled = 0, sms_enabled = 0, opted_out_at = ?, updated_at = ? WHERE firm_id = ? AND actor_type = 'client' AND actor_id = ?",
        )
        .run(revokedAt, revokedAt, session.firmId, clientId);
    }
    return client;
  },

  shareMatterWithClient(this: SqliteStoreCore, session: ProductSession, matterId: string, clientId: string): ClientMembership | null {
    const firmId = this.getMatterFirmId(matterId);
    const client = this.db.prepare("SELECT id FROM client_accounts WHERE id = ? AND status = 'active'").get(clientId) as { id: string } | undefined;
    if (
      session.actorType !== "staff" ||
      !session.firmId ||
      !firmId ||
      session.firmId !== firmId ||
      !this.canAccessMatter(session, matterId, firmId) ||
      !client ||
      (!this.clientBelongsToFirm(clientId, firmId) &&
        !(this.db.prepare("SELECT id FROM client_accounts WHERE id = ? AND firm_id = ?").get(clientId, firmId) as { id: string } | undefined))
    ) {
      return null;
    }
    const membership: ClientMembership = {
      id: randomUUID(),
      clientAccountId: clientId,
      matterId,
      accessLevel: "message",
    };
    this.db
      .prepare(`
        INSERT INTO client_memberships (id, client_account_id, matter_id, access_level, created_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(client_account_id, matter_id) DO UPDATE SET access_level = excluded.access_level
      `)
      .run(membership.id, membership.clientAccountId, membership.matterId, membership.accessLevel, nowIso());
    return membership;
  },

  unlinkMatterFromClient(this: SqliteStoreCore, session: ProductSession, matterId: string, clientId: string): boolean {
    const firmId = this.getMatterFirmId(matterId);
    if (session.actorType !== "staff" || !session.firmId || firmId !== session.firmId) {
      return false;
    }
    const removed = this.db
      .prepare("DELETE FROM client_memberships WHERE matter_id = ? AND client_account_id = ?")
      .run(matterId, clientId);
    if (Number(removed.changes ?? 0) !== 1) {
      return false;
    }
    const revokedAt = nowIso();
    this.db
      .prepare("UPDATE portal_links SET revoked_at = ? WHERE matter_id = ? AND client_account_id = ? AND revoked_at IS NULL")
      .run(revokedAt, matterId, clientId);
    this.db
      .prepare(`
        DELETE FROM notification_jobs
        WHERE firm_id = ? AND actor_type = 'client' AND actor_id = ?
          AND json_extract(payload_json, '$.matterId') = ? AND status IN ('pending', 'retrying')
      `)
      .run(firmId, clientId, matterId);
    return true;
  },

  getClientDetail(this: SqliteStoreCore, session: ProductSession, clientId: string): ProductClientDetail | null {
    if (session.actorType !== "staff" || !session.firmId) {
      return null;
    }

    const client = clientMethods.listClients.call(this, session).find((entry) => entry.id === clientId);
    if (!client) {
      return null;
    }

    const matters = (this.db
      .prepare(`
        SELECT m.id
        FROM matters m
        JOIN client_memberships cm ON cm.matter_id = m.id
        WHERE cm.client_account_id = ? AND m.firm_id = ?
        ORDER BY m.created_at ASC
      `)
      .all(clientId, session.firmId) as Array<{ id: string }>)
      .map((row) => matterMethods.getMatter.call(this, session, row.id))
      .filter((matter): matter is MatterDetail => Boolean(matter))
      .map((matter) => ({
        id: matter.id,
        firmId: matter.firmId,
        courtId: matter.courtId,
        rawCaseNumber: matter.rawCaseNumber,
        normalizedCaseNumber: matter.normalizedCaseNumber,
        title: matter.title,
        matterType: matter.matterType,
        stage: matter.stage,
        status: matter.status,
        nextHearingAt: matter.nextHearingAt,
        leadLawyerId: matter.leadLawyerId,
      }));

    const invoices = this.db
      .prepare(`
        SELECT
          id,
          firm_id AS firmId,
          client_account_id AS clientAccountId,
          matter_id AS matterId,
          status,
          issued_at AS issuedAt,
          due_at AS dueAt,
          total
        FROM invoices
        WHERE client_account_id = ? AND firm_id = ?
        ORDER BY created_at DESC
      `)
      .all(clientId, session.firmId) as unknown as Invoice[];

    const matterById = new Map(matters.map((matter) => [matter.id, matter]));
    const threadSummaries = this.listThreads(session).filter((thread) => matterById.has(thread.matter.id));

    return { client, matters, invoices, threadSummaries };
  },
};
