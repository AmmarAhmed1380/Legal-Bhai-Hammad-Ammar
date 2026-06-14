import { createHash, randomUUID } from "node:crypto";

import type {
  AuditEvent,
  CalendarItem,
  ClientAccount,
  ClientMembership,
  CourtSource,
  DocumentLink,
  Firm,
  FirmMembership,
  Hearing,
  IngestionRun,
  Invoice,
  Matter,
  MatterParty,
  Message,
  MessageThread,
  PortalLink,
  ProductAlert,
  ProductAuthMethod,
  ProductDocument,
  ProductLanguage,
  ProductSession,
  ProductUser,
  Session,
  TimeEntry,
} from "@wakeel/shared";
import { Pool, types, type PoolClient, type QueryResultRow } from "pg";

import {
  getCourtSourceDefinition,
  normalizeCourtCaseNumber,
  type CourtCauseListEntry,
  type CourtListType,
} from "./court-sources.js";
import type { ValidatedMatterCsvRow } from "./csv-import.js";
import type { IhcCauseListRow } from "./ihc.js";
import { nextDayAgendaSchedule, type NotificationTemplate } from "./notification-schedule.js";
import type {
  CsvImportPreview,
  MatterDetail,
  NotificationJobRecord,
  NotificationPreference,
  OverviewReport,
  ProductClientDetail,
  ProductClientSummary,
  ProductProfile,
  SearchHit,
} from "./product-store.js";
import { normalizePakistanPhone } from "./validation.js";

types.setTypeParser(1082, (value) => value);
types.setTypeParser(1184, (value) => value);
types.setTypeParser(1700, (value) => Number(value));

const OWNER_PERMISSIONS = [
  "*",
  "matters.read",
  "matters.write",
  "clients.write",
  "hearings.write",
  "documents.read",
  "documents.write",
  "messages.write",
  "court.sync",
  "portal.write",
];

function nowIso(): string {
  return new Date().toISOString();
}

function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function camelKey(key: string): string {
  return key.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

function mapRow<T>(row: QueryResultRow): T {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [camelKey(key), value])) as T;
}

function mapRows<T>(rows: QueryResultRow[]): T[] {
  return rows.map((row) => mapRow<T>(row));
}

interface OtpRequestInput {
  actorType: "staff" | "client";
  phone: string;
  code: string;
}

interface CreateMatterInput {
  firmId: string;
  courtId: string;
  rawCaseNumber: string;
  normalizedCaseNumber: string;
  title: string;
  matterType: Matter["matterType"];
  stage: string;
  status: Matter["status"];
  nextHearingAt: string | null;
  leadLawyerId: string | null;
}

interface CreateDocumentInput {
  firmId: string;
  matterId: string | null;
  folderId?: string | null;
  type: ProductDocument["type"];
  title: string;
  storageKey: string;
  mimeType: string;
  uploadedBy: string;
  ocrStatus: ProductDocument["ocrStatus"];
  ocrText: string | null;
  searchText: string | null;
  portalVisible?: boolean;
}

interface PortalAccess {
  link: PortalLink;
  clientAccount: ClientAccount;
  session: ProductSession;
}

export class PostgresProductStore {
  readonly kind = "postgres";
  private readonly pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      max: Number(process.env.POSTGRES_POOL_SIZE ?? 10),
      statement_timeout: Number(process.env.POSTGRES_STATEMENT_TIMEOUT_MS ?? 10_000),
      options: process.env.POSTGRES_OPTIONS,
      ssl: process.env.POSTGRES_SSL === "true" ? { rejectUnauthorized: true } : undefined,
    });
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.pool.query<{ ok: number }>("SELECT 1 AS ok");
      return result.rows[0]?.ok === 1;
    } catch {
      return false;
    }
  }

  private async transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async recalculateCalendarConflicts(client: PoolClient, dates: string[]): Promise<void> {
    for (const date of new Set(dates.map((value) => value.slice(0, 10)))) {
      await client.query("UPDATE calendar_items SET conflict_state = 'none' WHERE listed_at::date = $1::date", [date]);
      await client.query(
        `UPDATE calendar_items ci SET conflict_state = 'possible'
         FROM matters m
         WHERE ci.matter_id = m.id AND ci.listed_at::date = $1::date AND m.lead_lawyer_id IS NOT NULL
           AND EXISTS (
             SELECT 1
             FROM calendar_items ci2
             JOIN matters m2 ON m2.id = ci2.matter_id
             WHERE ci2.listed_at::date = ci.listed_at::date
               AND m2.id <> m.id
               AND m2.lead_lawyer_id = m.lead_lawyer_id
               AND m2.court_id <> m.court_id
           )`,
        [date],
      );
    }
  }

  private async synchronizeManualCalendarItem(client: PoolClient, matterId: string, nextHearingAt: string | null): Promise<void> {
    const existing = await client.query<{ listed_date: string }>(
      "SELECT DISTINCT listed_at::date AS listed_date FROM calendar_items WHERE matter_id = $1",
      [matterId],
    );
    await client.query("DELETE FROM calendar_items WHERE matter_id = $1 AND source_type = 'manual_staff'", [matterId]);
    if (nextHearingAt) {
      await client.query(
        `INSERT INTO calendar_items (id, matter_id, listed_at, courtroom, bench, source_type, source_confidence, conflict_state)
         VALUES ($1, $2, $3, NULL, NULL, 'manual_staff', 1, 'none')`,
        [randomUUID(), matterId, nextHearingAt],
      );
    }
    await this.recalculateCalendarConflicts(client, [
      ...existing.rows.map((row) => row.listed_date),
      ...(nextHearingAt ? [nextHearingAt] : []),
    ]);
  }

  private async matterFirmId(matterId: string): Promise<string | null> {
    const result = await this.pool.query<{ firm_id: string }>("SELECT firm_id FROM matters WHERE id = $1", [matterId]);
    return result.rows[0]?.firm_id ?? null;
  }

  private async canAccessMatter(session: ProductSession, matterId: string, firmId?: string): Promise<boolean> {
    if (session.actorType === "staff") {
      return Boolean(session.firmId && session.firmId === (firmId ?? (await this.matterFirmId(matterId))));
    }
    const result = await this.pool.query(
      "SELECT 1 FROM client_memberships WHERE client_account_id = $1 AND matter_id = $2",
      [session.actorId, matterId],
    );
    return result.rowCount === 1;
  }

  private async staffBelongsToFirm(userId: string, firmId: string): Promise<boolean> {
    const result = await this.pool.query("SELECT 1 FROM firm_memberships WHERE user_id = $1 AND firm_id = $2", [userId, firmId]);
    return result.rowCount === 1;
  }

  private async clientBelongsToFirm(clientId: string, firmId: string): Promise<boolean> {
    const result = await this.pool.query("SELECT 1 FROM client_accounts WHERE id = $1 AND firm_id = $2", [clientId, firmId]);
    return result.rowCount === 1;
  }

  private async findStaffByPhone(phone: string): Promise<{ user: ProductUser; membership: FirmMembership } | null> {
    const result = await this.pool.query(
      `SELECT u.id, u.phone, u.email, u.display_name, u.language, u.status,
        fm.id AS membership_id, fm.firm_id, fm.role, fm.permissions, fm.office_label
       FROM product_users u
       JOIN firm_memberships fm ON fm.user_id = u.id
       WHERE u.phone = $1
       LIMIT 1`,
      [phone],
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return {
      user: mapRow<ProductUser>(row),
      membership: {
        id: row.membership_id,
        firmId: row.firm_id,
        userId: row.id,
        role: row.role,
        permissions: row.permissions,
        officeLabel: row.office_label,
      },
    };
  }

  private async findUniqueClientByPhone(phone: string): Promise<(ClientAccount & { firmId: string }) | null> {
    const result = await this.pool.query(
      "SELECT id, firm_id, phone, display_name, language, status FROM client_accounts WHERE phone = $1 ORDER BY created_at LIMIT 2",
      [phone],
    );
    return result.rows.length === 1 ? mapRow<ClientAccount & { firmId: string }>(result.rows[0]) : null;
  }

  async createOtpRequest(input: OtpRequestInput): Promise<{ expiresAt: string; devCode: string | null } | null> {
    const phone = normalizePakistanPhone(input.phone);
    if (!phone) {
      return null;
    }
    const recent = await this.pool.query<{ count: string }>(
      "SELECT COUNT(*) AS count FROM otp_requests WHERE actor_type = $1 AND phone = $2 AND created_at >= now() - interval '15 minutes'",
      [input.actorType, phone],
    );
    if (Number(recent.rows[0]?.count ?? 0) >= 5) {
      return null;
    }
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await this.pool.query(
      "INSERT INTO otp_requests (id, actor_type, phone, code_hash, expires_at) VALUES ($1, $2, $3, $4, $5)",
      [randomUUID(), input.actorType, phone, hashValue(input.code), expiresAt],
    );
    return { expiresAt, devCode: process.env.NODE_ENV === "production" ? null : input.code };
  }

  private async consumeOtpRequest(actorType: "staff" | "client", phone: string, code: string): Promise<boolean> {
    return this.transaction(async (client) => {
      const result = await client.query<{ id: string; code_hash: string }>(
        `SELECT id, code_hash FROM otp_requests
         WHERE actor_type = $1 AND phone = $2 AND used_at IS NULL AND expires_at >= now() AND attempt_count < 5
         ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
        [actorType, phone],
      );
      const row = result.rows[0];
      if (!row) {
        return false;
      }
      if (row.code_hash !== hashValue(code)) {
        await client.query("UPDATE otp_requests SET attempt_count = attempt_count + 1 WHERE id = $1", [row.id]);
        return false;
      }
      await client.query("UPDATE otp_requests SET used_at = now() WHERE id = $1", [row.id]);
      return true;
    });
  }

  async canRequestStaffOtp(phone: string): Promise<boolean> {
    const normalizedPhone = normalizePakistanPhone(phone);
    if (!normalizedPhone) {
      return false;
    }
    if (await this.findStaffByPhone(normalizedPhone)) {
      return true;
    }
    const result = await this.pool.query("SELECT 1 FROM pilot_invites WHERE phone = $1 AND status = 'invited'", [normalizedPhone]);
    return result.rowCount === 1;
  }

  async canRequestClientOtp(phone: string): Promise<boolean> {
    const normalizedPhone = normalizePakistanPhone(phone);
    const client = normalizedPhone ? await this.findUniqueClientByPhone(normalizedPhone) : null;
    return client?.status === "active";
  }

  async canRequestClientOtpForAccount(clientAccountId: string, phone: string): Promise<boolean> {
    const normalizedPhone = normalizePakistanPhone(phone);
    if (!normalizedPhone) {
      return false;
    }
    const result = await this.pool.query(
      "SELECT 1 FROM client_accounts WHERE id = $1 AND phone = $2 AND status = 'active'",
      [clientAccountId, normalizedPhone],
    );
    return result.rowCount === 1;
  }

  async createPilotInvite(input: { phone: string; email?: string | null }): Promise<{ id: string; phone: string; email: string | null } | null> {
    const phone = normalizePakistanPhone(input.phone);
    if (!phone) {
      return null;
    }
    const id = randomUUID();
    const result = await this.pool.query(
      `INSERT INTO pilot_invites (id, phone, email, status)
       VALUES ($1, $2, $3, 'invited')
       ON CONFLICT (phone) DO UPDATE SET email = excluded.email, status = 'invited', invited_at = now(), accepted_at = NULL
       RETURNING id, phone, email`,
      [id, phone, input.email ?? null],
    );
    return mapRow(result.rows[0]);
  }

  async registerInvitedSoloLawyer(input: {
    phone: string;
    code: string;
    displayName: string;
    email: string | null;
    firmName: string;
    primaryCity: string;
  }): Promise<ProductSession | null> {
    const phone = normalizePakistanPhone(input.phone);
    if (!phone || !(await this.canRequestStaffOtp(phone)) || !(await this.consumeOtpRequest("staff", phone, input.code))) {
      return null;
    }
    const existing = await this.findStaffByPhone(phone);
    if (existing) {
      return { actorType: "staff", actorId: existing.user.id, firmId: existing.membership.firmId };
    }
    return this.transaction(async (client) => {
      const userId = randomUUID();
      const firmId = randomUUID();
      await client.query(
        "INSERT INTO product_users (id, phone, email, display_name, language, status) VALUES ($1, $2, $3, $4, 'en', 'active')",
        [userId, phone, input.email, input.displayName.trim()],
      );
      await client.query(
        "INSERT INTO firms (id, name, primary_city, billing_plan, timezone, status) VALUES ($1, $2, $3, 'solo_plus', 'Asia/Karachi', 'trial')",
        [firmId, input.firmName.trim(), input.primaryCity.trim()],
      );
      await client.query(
        "INSERT INTO firm_memberships (id, firm_id, user_id, role, permissions, office_label) VALUES ($1, $2, $3, 'owner', $4, $5)",
        [randomUUID(), firmId, userId, JSON.stringify(OWNER_PERMISSIONS), input.primaryCity.trim()],
      );
      await client.query(
        `INSERT INTO notification_consents (id, firm_id, actor_type, actor_id, channel, status, source, granted_at)
         VALUES ($1, $2, 'staff', $3, 'sms', 'granted', 'pilot_registration', now())`,
        [randomUUID(), firmId, userId],
      );
      if (input.email) {
        await client.query(
          `INSERT INTO notification_consents (id, firm_id, actor_type, actor_id, channel, status, source, granted_at)
           VALUES ($1, $2, 'staff', $3, 'email', 'granted', 'pilot_registration', now())`,
          [randomUUID(), firmId, userId],
        );
      }
      await client.query(
        `INSERT INTO notification_preferences (id, firm_id, actor_type, actor_id, email_enabled, sms_enabled)
         VALUES ($1, $2, 'staff', $3, $4, true)`,
        [randomUUID(), firmId, userId, Boolean(input.email)],
      );
      await client.query("UPDATE pilot_invites SET status = 'accepted', accepted_at = now() WHERE phone = $1", [phone]);
      return { actorType: "staff" as const, actorId: userId, firmId };
    });
  }

  async verifyOtp(actorType: "staff" | "client", phone: string, code: string): Promise<ProductSession | null> {
    const normalizedPhone = normalizePakistanPhone(phone);
    if (!normalizedPhone) {
      return null;
    }
    if (actorType === "staff") {
      if (!(await this.consumeOtpRequest(actorType, normalizedPhone, code))) {
        return null;
      }
      const staff = await this.findStaffByPhone(normalizedPhone);
      return staff ? { actorType: "staff", actorId: staff.user.id, firmId: staff.membership.firmId } : null;
    }
    const client = await this.findUniqueClientByPhone(normalizedPhone);
    if (!client || client.status !== "active" || !(await this.consumeOtpRequest(actorType, normalizedPhone, code))) {
      return null;
    }
    return client ? { actorType: "client", actorId: client.id, firmId: client.firmId } : null;
  }

  async verifyClientOtpForAccount(clientAccountId: string, phone: string, code: string): Promise<ProductSession | null> {
    const normalizedPhone = normalizePakistanPhone(phone);
    if (!normalizedPhone) {
      return null;
    }
    const result = await this.pool.query(
      "SELECT id, firm_id FROM client_accounts WHERE id = $1 AND phone = $2 AND status = 'active'",
      [clientAccountId, normalizedPhone],
    );
    const client = result.rows[0];
    if (!client || !(await this.consumeOtpRequest("client", normalizedPhone, code))) {
      return null;
    }
    return { actorType: "client", actorId: client.id, firmId: client.firm_id };
  }

  async createSession(input: ProductSession & { authMethod: ProductAuthMethod }): Promise<Session> {
    const result = await this.pool.query(
      `INSERT INTO app_sessions (id, actor_type, actor_id, firm_id, auth_method)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, actor_type, actor_id, firm_id, auth_method, created_at, revoked_at`,
      [randomUUID(), input.actorType, input.actorId, input.firmId, input.authMethod],
    );
    return mapRow<Session>(result.rows[0]);
  }

  async getActiveSession(id: string): Promise<Session | null> {
    const result = await this.pool.query(
      "SELECT id, actor_type, actor_id, firm_id, auth_method, created_at, revoked_at FROM app_sessions WHERE id = $1 AND revoked_at IS NULL",
      [id],
    );
    return result.rows[0] ? mapRow<Session>(result.rows[0]) : null;
  }

  async listSessions(session: ProductSession): Promise<Session[]> {
    const result = await this.pool.query(
      "SELECT id, actor_type, actor_id, firm_id, auth_method, created_at, revoked_at FROM app_sessions WHERE actor_type = $1 AND actor_id = $2 ORDER BY created_at DESC",
      [session.actorType, session.actorId],
    );
    return mapRows<Session>(result.rows);
  }

  async revokeSession(id: string): Promise<boolean> {
    const result = await this.pool.query("UPDATE app_sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL", [id]);
    await this.pool.query("UPDATE refresh_tokens SET revoked_at = now() WHERE session_id = $1 AND revoked_at IS NULL", [id]);
    return result.rowCount === 1;
  }

  async createRefreshToken(sessionId: string, ttlDays = 30): Promise<{ refreshToken: string; expiresAt: string } | null> {
    if (!(await this.getActiveSession(sessionId))) {
      return null;
    }
    const refreshToken = randomUUID().replace(/-/g, "");
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString();
    await this.pool.query(
      "INSERT INTO refresh_tokens (id, session_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)",
      [randomUUID(), sessionId, hashValue(refreshToken), expiresAt],
    );
    return { refreshToken, expiresAt };
  }

  async rotateRefreshToken(rawToken: string): Promise<{ session: Session; refreshToken: string; expiresAt: string } | null> {
    return this.transaction(async (client) => {
      const result = await client.query(
        `SELECT s.id, s.actor_type, s.actor_id, s.firm_id, s.auth_method, s.created_at, s.revoked_at, rt.id AS refresh_id
         FROM refresh_tokens rt JOIN app_sessions s ON s.id = rt.session_id
         WHERE rt.token_hash = $1 AND rt.revoked_at IS NULL AND rt.expires_at >= now() AND s.revoked_at IS NULL
         LIMIT 1 FOR UPDATE OF rt`,
        [hashValue(rawToken)],
      );
      const row = result.rows[0];
      if (!row) {
        return null;
      }
      await client.query("UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1", [row.refresh_id]);
      const refreshToken = randomUUID().replace(/-/g, "");
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await client.query(
        "INSERT INTO refresh_tokens (id, session_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)",
        [randomUUID(), row.id, hashValue(refreshToken), expiresAt],
      );
      return { session: mapRow<Session>(row), refreshToken, expiresAt };
    });
  }

  async getProfile(session: ProductSession): Promise<ProductProfile | null> {
    if (session.actorType === "staff") {
      const result = await this.pool.query(
        `SELECT u.id, u.phone, u.email, u.display_name, u.language, u.status,
          fm.id AS membership_id, fm.firm_id, fm.role, fm.permissions, fm.office_label,
          f.name, f.primary_city, f.billing_plan, f.timezone, f.status AS firm_status
         FROM product_users u JOIN firm_memberships fm ON fm.user_id = u.id JOIN firms f ON f.id = fm.firm_id
         WHERE u.id = $1 LIMIT 1`,
        [session.actorId],
      );
      const row = result.rows[0];
      if (!row) {
        return null;
      }
      return {
        actorType: "staff",
        firm: {
          id: row.firm_id,
          name: row.name,
          primaryCity: row.primary_city,
          billingPlan: row.billing_plan,
          timezone: row.timezone,
          status: row.firm_status,
        },
        staffUser: {
          id: row.id,
          phone: row.phone,
          email: row.email,
          displayName: row.display_name,
          language: row.language,
          status: row.status,
        },
        staffMembership: {
          id: row.membership_id,
          firmId: row.firm_id,
          userId: row.id,
          role: row.role,
          permissions: row.permissions,
          officeLabel: row.office_label,
        },
      };
    }
    const result = await this.pool.query(
      `SELECT c.id, c.phone, c.display_name, c.language, c.status, f.id AS firm_id, f.name, f.primary_city,
        f.billing_plan, f.timezone, f.status AS firm_status
       FROM client_accounts c JOIN firms f ON f.id = c.firm_id WHERE c.id = $1 LIMIT 1`,
      [session.actorId],
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return {
      actorType: "client",
      firm: {
        id: row.firm_id,
        name: row.name,
        primaryCity: row.primary_city,
        billingPlan: row.billing_plan,
        timezone: row.timezone,
        status: row.firm_status,
      },
      clientAccount: {
        id: row.id,
        phone: row.phone,
        displayName: row.display_name,
        language: row.language,
        status: row.status,
      },
    };
  }

  async listFirmMembers(firmId: string): Promise<Array<ProductUser & { membership: FirmMembership }>> {
    const result = await this.pool.query(
      `SELECT u.id, u.phone, u.email, u.display_name, u.language, u.status,
        fm.id AS membership_id, fm.firm_id, fm.role, fm.permissions, fm.office_label
       FROM product_users u JOIN firm_memberships fm ON fm.user_id = u.id WHERE fm.firm_id = $1 ORDER BY u.display_name`,
      [firmId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      phone: row.phone,
      email: row.email,
      displayName: row.display_name,
      language: row.language,
      status: row.status,
      membership: {
        id: row.membership_id,
        firmId: row.firm_id,
        userId: row.id,
        role: row.role,
        permissions: row.permissions,
        officeLabel: row.office_label,
      },
    }));
  }

  async createMagicLinkRequest(email: string): Promise<{ expiresAt: string; devToken: string | null } | null> {
    const staff = await this.pool.query<{ id: string }>("SELECT id FROM product_users WHERE lower(email) = lower($1)", [email]);
    if (!staff.rows[0]) {
      return null;
    }
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await this.pool.query(
      "INSERT INTO magic_link_tokens (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)",
      [randomUUID(), staff.rows[0].id, hashValue(token), expiresAt],
    );
    return { expiresAt, devToken: process.env.NODE_ENV === "production" ? null : token };
  }

  async verifyMagicLink(token: string): Promise<ProductSession | null> {
    const result = await this.pool.query<{ id: string; user_id: string; firm_id: string }>(
      `SELECT mlt.id, mlt.user_id, fm.firm_id
       FROM magic_link_tokens mlt JOIN firm_memberships fm ON fm.user_id = mlt.user_id
       WHERE mlt.token_hash = $1 AND mlt.used_at IS NULL AND mlt.expires_at >= now() LIMIT 1`,
      [hashValue(token)],
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    await this.pool.query("UPDATE magic_link_tokens SET used_at = now() WHERE id = $1", [row.id]);
    return { actorType: "staff", actorId: row.user_id, firmId: row.firm_id };
  }

  async createFirm(input: { name: string; primaryCity: string; ownerUserId: string }): Promise<Firm> {
    const result = await this.transaction(async (client) => {
      const firm = await client.query(
        `INSERT INTO firms (id, name, primary_city) VALUES ($1, $2, $3)
         RETURNING id, name, primary_city, billing_plan, timezone, status`,
        [randomUUID(), input.name, input.primaryCity],
      );
      await client.query(
        "INSERT INTO firm_memberships (id, firm_id, user_id, role, permissions) VALUES ($1, $2, $3, 'owner', $4)",
        [randomUUID(), firm.rows[0].id, input.ownerUserId, JSON.stringify(OWNER_PERMISSIONS)],
      );
      return firm.rows[0];
    });
    return mapRow<Firm>(result);
  }

  async getFirm(id: string): Promise<Firm | null> {
    const result = await this.pool.query("SELECT id, name, primary_city, billing_plan, timezone, status FROM firms WHERE id = $1", [id]);
    return result.rows[0] ? mapRow<Firm>(result.rows[0]) : null;
  }

  async createInvitation(
    firmId: string,
    invitation: { phone: string; email?: string | null; role: FirmMembership["role"]; officeLabel: string | null },
  ): Promise<{ invitationId: string }> {
    const phone = normalizePakistanPhone(invitation.phone);
    if (!phone) {
      throw new Error("Invalid Pakistani mobile number");
    }
    return this.transaction(async (client) => {
      const userId = randomUUID();
      const membershipId = randomUUID();
      await client.query(
        "INSERT INTO product_users (id, phone, email, display_name, status) VALUES ($1, $2, $3, $2, 'invited')",
        [userId, phone, invitation.email ?? null],
      );
      await client.query(
        "INSERT INTO firm_memberships (id, firm_id, user_id, role, permissions, office_label) VALUES ($1, $2, $3, $4, $5, $6)",
        [membershipId, firmId, userId, invitation.role, JSON.stringify(["matters.read"]), invitation.officeLabel],
      );
      return { invitationId: membershipId };
    });
  }

  async updateMembership(
    session: ProductSession,
    membershipId: string,
    patch: Partial<Pick<FirmMembership, "role" | "permissions" | "officeLabel">>,
  ): Promise<FirmMembership | null> {
    if (session.actorType !== "staff" || !session.firmId) {
      return null;
    }
    const result = await this.pool.query(
      `UPDATE firm_memberships SET role = COALESCE($1, role), permissions = COALESCE($2, permissions), office_label = COALESCE($3, office_label)
       WHERE id = $4 AND firm_id = $5 RETURNING id, firm_id, user_id, role, permissions, office_label`,
      [patch.role ?? null, patch.permissions ? JSON.stringify(patch.permissions) : null, patch.officeLabel ?? null, membershipId, session.firmId],
    );
    return result.rows[0] ? mapRow<FirmMembership>(result.rows[0]) : null;
  }

  async listMatters(session: ProductSession): Promise<Matter[]> {
    const access = session.actorType === "staff"
      ? "m.firm_id = $1"
      : "EXISTS (SELECT 1 FROM client_memberships cm WHERE cm.matter_id = m.id AND cm.client_account_id = $1)";
    const result = await this.pool.query(
      `SELECT m.id, m.firm_id, m.court_id, m.raw_case_number, m.normalized_case_number, m.title,
        m.matter_type, m.stage, m.status, m.next_hearing_at, m.lead_lawyer_id
       FROM matters m WHERE ${access} ORDER BY m.next_hearing_at NULLS LAST, m.title`,
      [session.actorType === "staff" ? session.firmId : session.actorId],
    );
    return mapRows<Matter>(result.rows);
  }

  async createMatter(session: ProductSession, input: CreateMatterInput): Promise<Matter | null> {
    if (session.actorType !== "staff" || !session.firmId || session.firmId !== input.firmId) {
      return null;
    }
    if (input.leadLawyerId && !(await this.staffBelongsToFirm(input.leadLawyerId, input.firmId))) {
      return null;
    }
    try {
      return await this.transaction(async (client) => {
        const result = await client.query(
          `INSERT INTO matters (id, firm_id, court_id, raw_case_number, normalized_case_number, title, matter_type, stage, status, next_hearing_at, lead_lawyer_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING id, firm_id, court_id, raw_case_number, normalized_case_number, title, matter_type, stage, status, next_hearing_at, lead_lawyer_id`,
          [
            randomUUID(),
            input.firmId,
            input.courtId,
            input.rawCaseNumber,
            input.normalizedCaseNumber || normalizeCourtCaseNumber(input.courtId, input.rawCaseNumber),
            input.title,
            input.matterType,
            input.stage,
            input.status,
            input.nextHearingAt,
            input.leadLawyerId,
          ],
        );
        const matter = mapRow<Matter>(result.rows[0]);
        await client.query("INSERT INTO message_threads (id, matter_id) VALUES ($1, $2)", [randomUUID(), matter.id]);
        await this.synchronizeManualCalendarItem(client, matter.id, matter.nextHearingAt);
        return matter;
      });
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        return null;
      }
      throw error;
    }
  }

  async getMatter(session: ProductSession, matterId: string): Promise<MatterDetail | null> {
    const result = await this.pool.query(
      `SELECT id, firm_id, court_id, raw_case_number, normalized_case_number, title, matter_type, stage, status, next_hearing_at, lead_lawyer_id
       FROM matters WHERE id = $1`,
      [matterId],
    );
    const matter = result.rows[0] ? mapRow<Matter>(result.rows[0]) : null;
    if (!matter || !(await this.canAccessMatter(session, matter.id, matter.firmId))) {
      return null;
    }
    const [parties, hearings, documents, threadResult, lawyerResult] = await Promise.all([
      this.pool.query("SELECT id, matter_id, party_type, display_name, contact_ref FROM matter_parties WHERE matter_id = $1 ORDER BY created_at", [matterId]),
      this.listHearings(session, matterId),
      this.listDocuments(session, { matterId }),
      this.pool.query("SELECT id, matter_id, participant_type, status FROM message_threads WHERE matter_id = $1", [matterId]),
      matter.leadLawyerId
        ? this.pool.query("SELECT id, phone, email, display_name, language, status FROM product_users WHERE id = $1", [matter.leadLawyerId])
        : Promise.resolve({ rows: [] as QueryResultRow[] }),
    ]);
    return {
      ...matter,
      leadLawyer: lawyerResult.rows[0] ? mapRow<ProductUser>(lawyerResult.rows[0]) : null,
      parties: mapRows<MatterParty>(parties.rows),
      hearings,
      documents,
      thread: threadResult.rows[0] ? mapRow<MessageThread>(threadResult.rows[0]) : null,
    };
  }

  async updateMatter(session: ProductSession, matterId: string, patch: Partial<Omit<CreateMatterInput, "firmId">>): Promise<Matter | null> {
    const existing = await this.getMatter(session, matterId);
    if (!existing || session.actorType !== "staff") {
      return null;
    }
    if (patch.leadLawyerId && !(await this.staffBelongsToFirm(patch.leadLawyerId, existing.firmId))) {
      return null;
    }
    return this.transaction(async (client) => {
      const result = await client.query(
        `UPDATE matters SET court_id = $1, raw_case_number = $2, normalized_case_number = $3, title = $4, matter_type = $5,
          stage = $6, status = $7, next_hearing_at = $8, lead_lawyer_id = $9, updated_at = now()
         WHERE id = $10 AND firm_id = $11
         RETURNING id, firm_id, court_id, raw_case_number, normalized_case_number, title, matter_type, stage, status, next_hearing_at, lead_lawyer_id`,
        [
          patch.courtId ?? existing.courtId,
          patch.rawCaseNumber ?? existing.rawCaseNumber,
          patch.normalizedCaseNumber ?? existing.normalizedCaseNumber,
          patch.title ?? existing.title,
          patch.matterType ?? existing.matterType,
          patch.stage ?? existing.stage,
          patch.status ?? existing.status,
          patch.nextHearingAt === undefined ? existing.nextHearingAt : patch.nextHearingAt,
          patch.leadLawyerId === undefined ? existing.leadLawyerId : patch.leadLawyerId,
          matterId,
          existing.firmId,
        ],
      );
      const matter = result.rows[0] ? mapRow<Matter>(result.rows[0]) : null;
      if (matter && (patch.nextHearingAt !== undefined || patch.courtId !== undefined || patch.leadLawyerId !== undefined)) {
        await this.synchronizeManualCalendarItem(client, matter.id, matter.nextHearingAt);
      }
      return matter;
    });
  }

  async createMatterParty(
    session: ProductSession,
    matterId: string,
    input: Pick<MatterParty, "partyType" | "displayName" | "contactRef">,
  ): Promise<MatterParty | null> {
    const firmId = await this.matterFirmId(matterId);
    if (session.actorType !== "staff" || !firmId || session.firmId !== firmId || !input.displayName.trim()) {
      return null;
    }
    const result = await this.pool.query(
      `INSERT INTO matter_parties (id, matter_id, party_type, display_name, contact_ref)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, matter_id, party_type, display_name, contact_ref`,
      [randomUUID(), matterId, input.partyType, input.displayName.trim(), input.contactRef],
    );
    return mapRow<MatterParty>(result.rows[0]);
  }

  async updateMatterParty(
    session: ProductSession,
    matterId: string,
    partyId: string,
    patch: Partial<Pick<MatterParty, "partyType" | "displayName" | "contactRef">>,
  ): Promise<MatterParty | null> {
    const firmId = await this.matterFirmId(matterId);
    if (session.actorType !== "staff" || !firmId || session.firmId !== firmId) {
      return null;
    }
    const result = await this.pool.query(
      `UPDATE matter_parties SET party_type = COALESCE($1, party_type), display_name = COALESCE($2, display_name),
        contact_ref = CASE WHEN $3::boolean THEN $4::uuid ELSE contact_ref END
       WHERE id = $5 AND matter_id = $6 RETURNING id, matter_id, party_type, display_name, contact_ref`,
      [patch.partyType ?? null, patch.displayName?.trim() || null, patch.contactRef !== undefined, patch.contactRef ?? null, partyId, matterId],
    );
    return result.rows[0] ? mapRow<MatterParty>(result.rows[0]) : null;
  }

  async deleteMatterParty(session: ProductSession, matterId: string, partyId: string): Promise<boolean> {
    const firmId = await this.matterFirmId(matterId);
    if (session.actorType !== "staff" || !firmId || session.firmId !== firmId) {
      return false;
    }
    const result = await this.pool.query("DELETE FROM matter_parties WHERE id = $1 AND matter_id = $2", [partyId, matterId]);
    return result.rowCount === 1;
  }

  async createCsvImportPreview(session: ProductSession, rows: ValidatedMatterCsvRow[]): Promise<CsvImportPreview | null> {
    if (session.actorType !== "staff" || !session.firmId) {
      return null;
    }
    const existing = await this.pool.query<{ normalized_case_number: string }>(
      "SELECT normalized_case_number FROM matters WHERE firm_id = $1",
      [session.firmId],
    );
    const existingNumbers = new Set(existing.rows.map((row) => row.normalized_case_number));
    const seenNumbers = new Set<string>();
    const previewRows = rows.map((row) => {
      const normalizedCaseNumber = row.input ? normalizeCourtCaseNumber(row.input.courtId, row.input.rawCaseNumber) : null;
      const duplicate = Boolean(normalizedCaseNumber && (existingNumbers.has(normalizedCaseNumber) || seenNumbers.has(normalizedCaseNumber)));
      if (normalizedCaseNumber) {
        seenNumbers.add(normalizedCaseNumber);
      }
      const error = row.error ?? (duplicate ? "Duplicate case number in workspace or import" : null);
      return {
        rowNumber: row.rowNumber,
        state: error ? "rejected" : "accepted",
        normalizedCaseNumber,
        error,
        payload: row.input ? { ...row.input } : {},
      };
    });
    const jobId = randomUUID();
    const acceptedRows = previewRows.filter((row) => row.state === "accepted").length;
    await this.transaction(async (client) => {
      await client.query(
        `INSERT INTO csv_import_jobs (id, firm_id, created_by, status, total_rows, accepted_rows, rejected_rows)
         VALUES ($1, $2, $3, 'preview', $4, $5, $6)`,
        [jobId, session.firmId, session.actorId, rows.length, acceptedRows, rows.length - acceptedRows],
      );
      for (const row of previewRows) {
        await client.query(
          `INSERT INTO csv_import_rows (id, job_id, row_number, payload, normalized_case_number, state, error)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [randomUUID(), jobId, row.rowNumber, JSON.stringify(row.payload), row.normalizedCaseNumber, row.state, row.error],
        );
      }
    });
    return { id: jobId, status: "preview", totalRows: rows.length, acceptedRows, rejectedRows: rows.length - acceptedRows, rows: previewRows };
  }

  async getCsvImportPreview(session: ProductSession, jobId: string, rejectedOnly = false): Promise<CsvImportPreview | null> {
    if (session.actorType !== "staff" || !session.firmId) {
      return null;
    }
    const jobResult = await this.pool.query(
      "SELECT id, status, total_rows, accepted_rows, rejected_rows FROM csv_import_jobs WHERE id = $1 AND firm_id = $2",
      [jobId, session.firmId],
    );
    if (!jobResult.rows[0]) {
      return null;
    }
    const rowResult = await this.pool.query(
      `SELECT row_number, payload, normalized_case_number, state, error
       FROM csv_import_rows WHERE job_id = $1 ${rejectedOnly ? "AND state = 'rejected'" : ""} ORDER BY row_number`,
      [jobId],
    );
    return {
      ...mapRow<Omit<CsvImportPreview, "rows">>(jobResult.rows[0]),
      rows: mapRows<CsvImportPreview["rows"][number]>(rowResult.rows),
    };
  }

  async confirmCsvImport(session: ProductSession, jobId: string): Promise<CsvImportPreview | null> {
    const preview = await this.getCsvImportPreview(session, jobId);
    if (!preview || preview.status !== "preview" || !session.firmId) {
      return null;
    }
    for (const row of preview.rows.filter((entry) => entry.state === "accepted")) {
      const input = row.payload as unknown as NonNullable<ValidatedMatterCsvRow["input"]>;
      const matter = await this.createMatter(session, {
        firmId: session.firmId,
        courtId: input.courtId,
        rawCaseNumber: input.rawCaseNumber,
        normalizedCaseNumber: row.normalizedCaseNumber ?? normalizeCourtCaseNumber(input.courtId, input.rawCaseNumber),
        title: input.title,
        matterType: input.matterType,
        stage: input.stage,
        status: "open",
        nextHearingAt: input.nextHearingAt,
        leadLawyerId: session.actorId,
      });
      await this.pool.query(
        "UPDATE csv_import_rows SET state = $1, matter_id = $2, error = $3 WHERE job_id = $4 AND row_number = $5",
        [matter ? "imported" : "rejected", matter?.id ?? null, matter ? null : "Duplicate or invalid matter", jobId, row.rowNumber],
      );
    }
    await this.pool.query("UPDATE csv_import_jobs SET status = 'confirmed', confirmed_at = now() WHERE id = $1 AND firm_id = $2", [jobId, session.firmId]);
    return this.getCsvImportPreview(session, jobId);
  }

  async listHearings(session: ProductSession, matterId: string): Promise<Hearing[]> {
    if (!(await this.canAccessMatter(session, matterId))) {
      return [];
    }
    const result = await this.pool.query(
      `SELECT id, matter_id, listed_at, outcome, notes, next_date, courtroom, bench, source_type, document_id
       FROM hearings WHERE matter_id = $1 ORDER BY listed_at DESC, created_at DESC`,
      [matterId],
    );
    return mapRows<Hearing>(result.rows);
  }

  async addHearing(session: ProductSession, input: {
    matterId: string;
    listedAt: string;
    outcome: string;
    notes: string;
    nextDate: string | null;
    courtroom: string | null;
    bench: string | null;
    sourceType: string;
    documentId: string | null;
  }): Promise<Hearing | null> {
    const firmId = await this.matterFirmId(input.matterId);
    if (session.actorType !== "staff" || !firmId || !(await this.canAccessMatter(session, input.matterId, firmId))) {
      return null;
    }
    if (input.documentId && !(await this.getDocument(session, input.documentId))) {
      return null;
    }
    return this.transaction(async (client) => {
      const result = await client.query(
        `INSERT INTO hearings (id, matter_id, listed_at, outcome, notes, next_date, courtroom, bench, source_type, document_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, matter_id, listed_at, outcome, notes, next_date, courtroom, bench, source_type, document_id`,
        [randomUUID(), input.matterId, input.listedAt, input.outcome, input.notes, input.nextDate, input.courtroom, input.bench, input.sourceType, input.documentId],
      );
      const hearing = mapRow<Hearing>(result.rows[0]);
      if (input.nextDate) {
        await client.query("UPDATE matters SET next_hearing_at = $1, updated_at = now() WHERE id = $2", [input.nextDate, input.matterId]);
        await this.synchronizeManualCalendarItem(client, input.matterId, input.nextDate);
      }
      await client.query(
        `INSERT INTO notification_jobs (id, firm_id, actor_type, actor_id, channel, template_key, payload, idempotency_key, scheduled_at)
         SELECT gen_random_uuid(), $1, 'client', cm.client_account_id, 'sms', 'post_hearing_update', $2,
           'post-hearing:' || $3 || ':' || cm.client_account_id || ':sms', now()
         FROM client_memberships cm
         JOIN client_accounts c ON c.id = cm.client_account_id
         JOIN notification_consents nc ON nc.firm_id = $1 AND nc.actor_type = 'client'
           AND nc.actor_id = cm.client_account_id AND nc.channel = 'sms' AND nc.status = 'granted' AND nc.revoked_at IS NULL
         LEFT JOIN notification_preferences np
           ON np.firm_id = $1 AND np.actor_type = 'client' AND np.actor_id = cm.client_account_id
         WHERE cm.matter_id = $4 AND c.status = 'active' AND np.opted_out_at IS NULL AND COALESCE(np.sms_enabled, true)
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [firmId, JSON.stringify({ matterId: hearing.matterId, outcome: hearing.outcome, notes: hearing.notes, nextDate: hearing.nextDate }), hearing.id, hearing.matterId],
      );
      await client.query(
        `INSERT INTO audit_events (id, firm_id, actor_type, actor_id, object_type, object_id, event_type, payload)
         VALUES ($1, $2, 'staff', $3, 'hearing', $4, 'hearing.created', $5)`,
        [randomUUID(), firmId, session.actorId, hearing.id, JSON.stringify({ matterId: hearing.matterId, sourceType: hearing.sourceType })],
      );
      return hearing;
    });
  }

  async listCalendar(session: ProductSession): Promise<Array<CalendarItem & { matter: Matter }>> {
    const matters = await this.listMatters(session);
    if (matters.length === 0) {
      return [];
    }
    const matterMap = new Map(matters.map((matter) => [matter.id, matter]));
    const result = await this.pool.query(
      "SELECT id, matter_id, listed_at, courtroom, bench, source_type, source_confidence, conflict_state FROM calendar_items ORDER BY listed_at",
    );
    return mapRows<CalendarItem>(result.rows)
      .filter((item) => matterMap.has(item.matterId))
      .map((item) => ({ ...item, matter: matterMap.get(item.matterId)! }));
  }

  async listCalendarConflicts(session: ProductSession): Promise<Array<CalendarItem & { matter: Matter }>> {
    return (await this.listCalendar(session)).filter((item) => item.conflictState !== "none");
  }

  async listDocuments(session: ProductSession, filters: { matterId?: string } = {}): Promise<ProductDocument[]> {
    const result = await this.pool.query(
      `SELECT id, firm_id, matter_id, folder_id, type, title, storage_key, mime_type, uploaded_by, ocr_status, ocr_text, search_text, portal_visible
       FROM documents WHERE ($1::uuid IS NULL OR matter_id = $1) ORDER BY created_at DESC`,
      [filters.matterId ?? null],
    );
    const documents = mapRows<ProductDocument>(result.rows);
    const accessible: ProductDocument[] = [];
    for (const document of documents) {
      if (
        session.actorType === "staff"
          ? session.firmId === document.firmId
          : Boolean(document.portalVisible && document.matterId && await this.canAccessMatter(session, document.matterId, document.firmId))
      ) {
        accessible.push(document);
      }
    }
    return accessible;
  }

  async createDocument(session: ProductSession, input: CreateDocumentInput): Promise<ProductDocument | null> {
    if (session.actorType !== "staff" || !session.firmId || session.firmId !== input.firmId || session.actorId !== input.uploadedBy) {
      return null;
    }
    if (input.matterId) {
      const matterFirmId = await this.matterFirmId(input.matterId);
      if (!matterFirmId || matterFirmId !== input.firmId || !(await this.canAccessMatter(session, input.matterId, matterFirmId))) {
        return null;
      }
    }
    const result = await this.pool.query(
      `INSERT INTO documents (id, firm_id, matter_id, folder_id, type, title, storage_key, mime_type, uploaded_by, ocr_status, ocr_text, search_text, portal_visible)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id, firm_id, matter_id, folder_id, type, title, storage_key, mime_type, uploaded_by, ocr_status, ocr_text, search_text, portal_visible`,
      [randomUUID(), input.firmId, input.matterId, input.folderId ?? null, input.type, input.title, input.storageKey, input.mimeType, input.uploadedBy, input.ocrStatus, input.ocrText, input.searchText, input.portalVisible ?? false],
    );
    return mapRow<ProductDocument>(result.rows[0]);
  }

  async getDocument(session: ProductSession, id: string): Promise<ProductDocument | null> {
    const result = await this.pool.query(
      "SELECT id, firm_id, matter_id, folder_id, type, title, storage_key, mime_type, uploaded_by, ocr_status, ocr_text, search_text, portal_visible FROM documents WHERE id = $1",
      [id],
    );
    const document = result.rows[0] ? mapRow<ProductDocument>(result.rows[0]) : null;
    if (!document) {
      return null;
    }
    const allowed = session.actorType === "staff"
      ? session.firmId === document.firmId
      : Boolean(document.portalVisible && document.matterId && await this.canAccessMatter(session, document.matterId, document.firmId));
    return allowed ? document : null;
  }

  async updateDocument(
    session: ProductSession,
    id: string,
    patch: Partial<Pick<ProductDocument, "title" | "matterId" | "folderId" | "searchText" | "portalVisible">>,
  ): Promise<ProductDocument | null> {
    const existing = await this.getDocument(session, id);
    if (!existing || session.actorType !== "staff") {
      return null;
    }
    if (patch.matterId) {
      const matterFirmId = await this.matterFirmId(patch.matterId);
      if (!matterFirmId || matterFirmId !== existing.firmId || !(await this.canAccessMatter(session, patch.matterId, matterFirmId))) {
        return null;
      }
    }
    const result = await this.pool.query(
      `UPDATE documents SET title = $1, matter_id = $2, folder_id = $3, search_text = $4, portal_visible = $5
       WHERE id = $6 AND firm_id = $7
       RETURNING id, firm_id, matter_id, folder_id, type, title, storage_key, mime_type, uploaded_by, ocr_status, ocr_text, search_text, portal_visible`,
      [
        patch.title ?? existing.title,
        patch.matterId === undefined ? existing.matterId : patch.matterId,
        patch.folderId === undefined ? existing.folderId : patch.folderId,
        patch.searchText === undefined ? existing.searchText : patch.searchText,
        patch.portalVisible ?? existing.portalVisible,
        id,
        existing.firmId,
      ],
    );
    return result.rows[0] ? mapRow<ProductDocument>(result.rows[0]) : null;
  }

  async linkDocument(session: ProductSession, documentId: string, matterId: string): Promise<DocumentLink | null> {
    const document = await this.getDocument(session, documentId);
    const firmId = await this.matterFirmId(matterId);
    if (session.actorType !== "staff" || !document || !firmId || firmId !== document.firmId || session.firmId !== firmId) {
      return null;
    }
    const result = await this.pool.query(
      `INSERT INTO document_links (id, document_id, matter_id) VALUES ($1, $2, $3)
       ON CONFLICT (document_id, matter_id) DO UPDATE SET matter_id = excluded.matter_id
       RETURNING id, document_id, matter_id`,
      [randomUUID(), documentId, matterId],
    );
    await this.pool.query("UPDATE documents SET matter_id = $1 WHERE id = $2 AND firm_id = $3", [matterId, documentId, firmId]);
    return mapRow<DocumentLink>(result.rows[0]);
  }

  async listThreads(session: ProductSession): Promise<Array<MessageThread & { matter: Matter; lastMessage: Message | null }>> {
    const matters = await this.listMatters(session);
    const output: Array<MessageThread & { matter: Matter; lastMessage: Message | null }> = [];
    for (const matter of matters) {
      const result = await this.pool.query(
        `SELECT mt.id, mt.matter_id, mt.participant_type, mt.status,
          msg.id AS message_id, msg.sender_type, msg.sender_id, msg.body, msg.language, msg.delivery_channel, msg.delivery_state, msg.created_at
         FROM message_threads mt
         LEFT JOIN LATERAL (SELECT * FROM messages WHERE thread_id = mt.id ORDER BY created_at DESC LIMIT 1) msg ON true
         WHERE mt.matter_id = $1`,
        [matter.id],
      );
      const row = result.rows[0];
      if (row) {
        output.push({
          id: row.id,
          matterId: row.matter_id,
          participantType: row.participant_type,
          status: row.status,
          matter,
          lastMessage: row.message_id ? {
            id: row.message_id,
            threadId: row.id,
            senderType: row.sender_type,
            senderId: row.sender_id,
            body: row.body,
            language: row.language,
            deliveryChannel: row.delivery_channel,
            deliveryState: row.delivery_state,
            createdAt: row.created_at,
          } : null,
        });
      }
    }
    return output;
  }

  async listMessages(session: ProductSession, threadId: string): Promise<Message[]> {
    const access = await this.pool.query<{ matter_id: string }>("SELECT matter_id FROM message_threads WHERE id = $1", [threadId]);
    if (!access.rows[0] || !(await this.canAccessMatter(session, access.rows[0].matter_id))) {
      return [];
    }
    const result = await this.pool.query(
      "SELECT id, thread_id, sender_type, sender_id, body, language, delivery_channel, delivery_state, created_at FROM messages WHERE thread_id = $1 ORDER BY created_at",
      [threadId],
    );
    return mapRows<Message>(result.rows);
  }

  async createMessage(
    session: ProductSession,
    threadId: string,
    input: { body: string; language: ProductLanguage; deliveryChannel: Message["deliveryChannel"] },
  ): Promise<Message | null> {
    const access = await this.pool.query<{ matter_id: string }>("SELECT matter_id FROM message_threads WHERE id = $1", [threadId]);
    if (!access.rows[0] || !(await this.canAccessMatter(session, access.rows[0].matter_id))) {
      return null;
    }
    const result = await this.pool.query(
      `INSERT INTO messages (id, thread_id, sender_type, sender_id, body, language, delivery_channel, delivery_state)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'delivered')
       RETURNING id, thread_id, sender_type, sender_id, body, language, delivery_channel, delivery_state, created_at`,
      [randomUUID(), threadId, session.actorType, session.actorId, input.body, input.language, input.deliveryChannel],
    );
    return mapRow<Message>(result.rows[0]);
  }

  async listClients(session: ProductSession): Promise<ProductClientSummary[]> {
    if (session.actorType !== "staff" || !session.firmId) {
      return [];
    }
    const result = await this.pool.query(
      `SELECT c.id, c.phone, c.display_name, c.language, c.status,
        COUNT(DISTINCT cm.matter_id)::int AS matter_count,
        0::int AS outstanding_total,
        MAX(msg.created_at) AS last_message_at,
        MIN(m.next_hearing_at) AS next_hearing_at
       FROM client_accounts c
       LEFT JOIN client_memberships cm ON cm.client_account_id = c.id
       LEFT JOIN matters m ON m.id = cm.matter_id AND m.firm_id = c.firm_id
       LEFT JOIN message_threads mt ON mt.matter_id = m.id
       LEFT JOIN messages msg ON msg.thread_id = mt.id
       WHERE c.firm_id = $1
       GROUP BY c.id ORDER BY c.display_name`,
      [session.firmId],
    );
    return mapRows<ProductClientSummary>(result.rows);
  }

  async createClient(session: ProductSession, input: { phone: string; displayName: string; language: ProductLanguage }): Promise<ClientAccount | null> {
    if (session.actorType !== "staff" || !session.firmId) {
      return null;
    }
    const phone = normalizePakistanPhone(input.phone);
    if (!phone || !input.displayName.trim()) {
      return null;
    }
    try {
      const result = await this.pool.query(
        `INSERT INTO client_accounts (id, firm_id, phone, display_name, language, status)
         VALUES ($1, $2, $3, $4, $5, 'active')
         RETURNING id, phone, display_name, language, status`,
        [randomUUID(), session.firmId, phone, input.displayName.trim(), input.language],
      );
      return mapRow<ClientAccount>(result.rows[0]);
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        const existing = await this.pool.query(
          "SELECT id, phone, display_name, language, status FROM client_accounts WHERE firm_id = $1 AND phone = $2",
          [session.firmId, phone],
        );
        return existing.rows[0] ? mapRow<ClientAccount>(existing.rows[0]) : null;
      }
      throw error;
    }
  }

  async updateClient(
    session: ProductSession,
    clientId: string,
    patch: Partial<Pick<ClientAccount, "displayName" | "language" | "status">>,
  ): Promise<ClientAccount | null> {
    if (session.actorType !== "staff" || !session.firmId) {
      return null;
    }
    return this.transaction(async (client) => {
      const result = await client.query(
        `UPDATE client_accounts SET display_name = COALESCE($1, display_name), language = COALESCE($2, language), status = COALESCE($3, status)
         WHERE id = $4 AND firm_id = $5 RETURNING id, phone, display_name, language, status`,
        [patch.displayName?.trim() || null, patch.language ?? null, patch.status ?? null, clientId, session.firmId],
      );
      if (!result.rows[0]) {
        return null;
      }
      if (patch.status === "archived") {
        await client.query(
          "UPDATE portal_links SET revoked_at = now() WHERE client_account_id = $1 AND revoked_at IS NULL",
          [clientId],
        );
        await client.query(
          "UPDATE app_sessions SET revoked_at = now() WHERE actor_type = 'client' AND actor_id = $1 AND revoked_at IS NULL",
          [clientId],
        );
        await client.query(
          "DELETE FROM notification_jobs WHERE firm_id = $1 AND actor_type = 'client' AND actor_id = $2 AND status IN ('pending', 'retrying')",
          [session.firmId, clientId],
        );
        await client.query(
          `UPDATE notification_consents SET status = 'revoked', revoked_at = now(), updated_at = now()
           WHERE firm_id = $1 AND actor_type = 'client' AND actor_id = $2 AND status = 'granted'`,
          [session.firmId, clientId],
        );
        await client.query(
          `UPDATE notification_preferences SET email_enabled = false, sms_enabled = false, opted_out_at = now(), updated_at = now()
           WHERE firm_id = $1 AND actor_type = 'client' AND actor_id = $2`,
          [session.firmId, clientId],
        );
      }
      return mapRow<ClientAccount>(result.rows[0]);
    });
  }

  async shareMatterWithClient(session: ProductSession, matterId: string, clientId: string): Promise<ClientMembership | null> {
    const firmId = await this.matterFirmId(matterId);
    const client = firmId
      ? await this.pool.query("SELECT 1 FROM client_accounts WHERE id = $1 AND firm_id = $2 AND status = 'active'", [clientId, firmId])
      : null;
    if (session.actorType !== "staff" || !firmId || session.firmId !== firmId || client?.rowCount !== 1) {
      return null;
    }
    const result = await this.pool.query(
      `INSERT INTO client_memberships (id, client_account_id, matter_id, access_level)
       VALUES ($1, $2, $3, 'message')
       ON CONFLICT (client_account_id, matter_id) DO UPDATE SET access_level = excluded.access_level
       RETURNING id, client_account_id, matter_id, access_level`,
      [randomUUID(), clientId, matterId],
    );
    return mapRow<ClientMembership>(result.rows[0]);
  }

  async unlinkMatterFromClient(session: ProductSession, matterId: string, clientId: string): Promise<boolean> {
    const firmId = await this.matterFirmId(matterId);
    if (session.actorType !== "staff" || !firmId || session.firmId !== firmId) {
      return false;
    }
    return this.transaction(async (client) => {
      const removed = await client.query(
        "DELETE FROM client_memberships WHERE matter_id = $1 AND client_account_id = $2",
        [matterId, clientId],
      );
      if (removed.rowCount !== 1) {
        return false;
      }
      await client.query(
        "UPDATE portal_links SET revoked_at = now() WHERE matter_id = $1 AND client_account_id = $2 AND revoked_at IS NULL",
        [matterId, clientId],
      );
      await client.query(
        `DELETE FROM notification_jobs
         WHERE firm_id = $1 AND actor_type = 'client' AND actor_id = $2
           AND payload->>'matterId' = $3 AND status IN ('pending', 'retrying')`,
        [firmId, clientId, matterId],
      );
      return true;
    });
  }

  async getClientDetail(session: ProductSession, clientId: string): Promise<ProductClientDetail | null> {
    const client = (await this.listClients(session)).find((entry) => entry.id === clientId);
    if (!client) {
      return null;
    }
    const matters = await this.listMatters(session);
    const linked = await this.pool.query<{ matter_id: string }>("SELECT matter_id FROM client_memberships WHERE client_account_id = $1", [clientId]);
    const linkedIds = new Set(linked.rows.map((row) => row.matter_id));
    const clientMatters = matters.filter((matter) => linkedIds.has(matter.id));
    return {
      client,
      matters: clientMatters,
      invoices: [],
      threadSummaries: (await this.listThreads(session)).filter((thread) => linkedIds.has(thread.matter.id)),
    };
  }

  async createPortalLink(session: ProductSession, matterId: string, ttlHours = 24 * 14, clientId?: string): Promise<{ portalLink: PortalLink; rawToken: string } | null> {
    const firmId = await this.matterFirmId(matterId);
    if (session.actorType !== "staff" || !firmId || session.firmId !== firmId) {
      return null;
    }
    const membership = await this.pool.query<{ client_account_id: string }>(
      `SELECT cm.client_account_id
       FROM client_memberships cm JOIN client_accounts c ON c.id = cm.client_account_id
       WHERE cm.matter_id = $1 AND c.status = 'active' AND ($2::uuid IS NULL OR c.id = $2)
       ORDER BY cm.created_at LIMIT 2`,
      [matterId, clientId ?? null],
    );
    if (membership.rows.length !== 1) {
      return null;
    }
    const rawToken = randomUUID().replace(/-/g, "");
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();
    const result = await this.pool.query(
      `INSERT INTO portal_links (id, matter_id, client_account_id, created_by, token_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, matter_id, client_account_id, created_by, expires_at, created_at, revoked_at`,
      [randomUUID(), matterId, membership.rows[0].client_account_id, session.actorId, hashValue(rawToken), expiresAt],
    );
    return { portalLink: mapRow<PortalLink>(result.rows[0]), rawToken };
  }

  async getPortalAccess(rawToken: string): Promise<PortalAccess | null> {
    const result = await this.pool.query(
      `SELECT pl.id, pl.matter_id, pl.client_account_id, pl.created_by, pl.expires_at, pl.created_at, pl.revoked_at,
        c.phone, c.display_name, c.language, c.status, c.firm_id
       FROM portal_links pl JOIN client_accounts c ON c.id = pl.client_account_id
       WHERE pl.token_hash = $1 AND pl.revoked_at IS NULL AND pl.expires_at >= now() AND c.status = 'active'
       LIMIT 1`,
      [hashValue(rawToken)],
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return {
      link: {
        id: row.id,
        matterId: row.matter_id,
        clientAccountId: row.client_account_id,
        createdBy: row.created_by,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
        revokedAt: row.revoked_at,
      },
      clientAccount: {
        id: row.client_account_id,
        phone: row.phone,
        displayName: row.display_name,
        language: row.language,
        status: row.status,
      },
      session: { actorType: "client", actorId: row.client_account_id, firmId: row.firm_id },
    };
  }

  async listPortalMattersForAccess(rawToken: string, portalLinkId: string): Promise<Matter[]> {
    const access = await this.getPortalAccess(rawToken);
    if (!access || access.link.id !== portalLinkId) {
      return [];
    }
    const matter = await this.getMatter(access.session, access.link.matterId);
    return matter ? [matter] : [];
  }

  async getPortalMatterForAccess(rawToken: string, portalLinkId: string, matterId: string): Promise<MatterDetail | null> {
    const access = await this.getPortalAccess(rawToken);
    if (!access || access.link.id !== portalLinkId || matterId !== access.link.matterId) {
      return null;
    }
    const matter = await this.getMatter(access.session, matterId);
    return matter ? { ...matter, documents: matter.documents.filter((document) => document.portalVisible) } : null;
  }

  async listCourtSources(): Promise<Array<CourtSource & { metrics: Record<string, number> }>> {
    const result = await this.pool.query(
      "SELECT id, court_id, source_type, ingestion_mode, status, last_successful_sync_at, metrics FROM court_sources ORDER BY court_id",
    );
    return mapRows<CourtSource & { metrics: Record<string, number> }>(result.rows).map((source) => ({
      ...source,
      officialUrl: getCourtSourceDefinition(source.id)?.officialUrl,
    }));
  }

  async ingestCourtCauseList(sourceId: string, rows: CourtCauseListEntry[], listDate: string, listType: CourtListType): Promise<{
    fetched: number;
    inserted: number;
    matched: number;
    unmatched: number;
  }> {
    const source = getCourtSourceDefinition(sourceId);
    if (!source) {
      throw new Error(`Unsupported court source: ${sourceId}`);
    }
    let inserted = 0;
    let matched = 0;
    await this.transaction(async (client) => {
      for (const row of rows) {
        const normalized = row.normalizedCaseNumber || normalizeCourtCaseNumber(row.courtId, row.rawCaseNumber);
        const sourceHash = hashValue(`${sourceId}|${listDate}|${listType}|${row.courtId}|${normalized}|${row.courtroom}|${row.bench}`);
        const entryResult = await client.query<{ id: string }>(
          `INSERT INTO cause_list_entries (id, court_source_id, court_id, list_date, list_type, normalized_case_number, raw_case_number, courtroom, bench, source_hash)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (source_hash) DO NOTHING RETURNING id`,
          [randomUUID(), sourceId, row.courtId, listDate, listType, normalized, row.rawCaseNumber, row.courtroom, row.bench, sourceHash],
        );
        const entryId = entryResult.rows[0]?.id;
        if (!entryId) {
          continue;
        }
        inserted += 1;
        const matters = await client.query<{ id: string; firm_id: string }>(
          "SELECT id, firm_id FROM matters WHERE court_id = $1 AND normalized_case_number = $2 AND status = 'open'",
          [row.courtId, normalized],
        );
        for (const matter of matters.rows) {
          if (row.confidence < 1) {
            continue;
          }
          const matchResult = await client.query(
            `INSERT INTO matter_matches (id, firm_id, matter_id, cause_list_entry_id, confidence, state)
             VALUES ($1, $2, $3, $4, $5, 'auto_matched')
             ON CONFLICT (matter_id, cause_list_entry_id) DO NOTHING`,
            [randomUUID(), matter.firm_id, matter.id, entryId, row.confidence],
          );
          if (matchResult.rowCount !== 1) {
            continue;
          }
          matched += 1;
          await this.synchronizeManualCalendarItem(client, matter.id, null);
          await client.query("UPDATE matters SET next_hearing_at = $1, updated_at = now() WHERE id = $2", [listDate, matter.id]);
          await client.query(
            `INSERT INTO calendar_items (id, matter_id, listed_at, courtroom, bench, source_type, source_confidence)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (matter_id, listed_at, source_type) DO UPDATE SET courtroom = excluded.courtroom, bench = excluded.bench`,
            [randomUUID(), matter.id, listDate, row.courtroom, row.bench, source.calendarSourceType, row.confidence],
          );
        }
      }
      await this.recalculateCalendarConflicts(client, [listDate]);
      const metrics = { fetched: rows.length, inserted, matched, unmatched: Math.max(inserted - matched, 0) };
      await client.query(
        "UPDATE court_sources SET status = 'live', last_successful_sync_at = now(), metrics = $1 WHERE id = $2",
        [JSON.stringify(metrics), sourceId],
      );
      await client.query(
        `INSERT INTO ingestion_runs (id, court_source_id, court_id, status, rows_fetched, rows_parsed, rows_matched, parser_failures, unmatched_count, note, started_at, finished_at)
         VALUES ($1, $2, $3, $4, $5, $5, $6, 0, $7, $8, now(), now())`,
        [
          randomUUID(),
          sourceId,
          source.courtId,
          metrics.unmatched > 0 ? "needs_review" : "completed",
          rows.length,
          matched,
          metrics.unmatched,
          metrics.unmatched > 0 ? `Unmatched ${source.displayName} entries require review.` : null,
        ],
      );
    });
    return { fetched: rows.length, inserted, matched, unmatched: Math.max(inserted - matched, 0) };
  }

  async ingestIhcCauseList(rows: IhcCauseListRow[], listDate: string, listType: CourtListType): Promise<{
    fetched: number;
    inserted: number;
    matched: number;
    unmatched: number;
  }> {
    const sourceUrl = getCourtSourceDefinition("source-ihc")?.officialUrl ?? "";
    return this.ingestCourtCauseList(
      "source-ihc",
      rows.map((row) => ({
        courtId: "ihc",
        rawCaseNumber: row.caseNumber,
        normalizedCaseNumber: normalizeCourtCaseNumber("ihc", row.caseNumber),
        courtroom: row.court || null,
        bench: row.judgeNames || null,
        parties: row.parties || null,
        advocates: row.advocates || null,
        sourceUrl,
        confidence: 1,
      })),
      listDate,
      listType,
    );
  }

  async listCourtMatchReview(session: ProductSession): Promise<Array<Record<string, unknown>>> {
    if (session.actorType !== "staff" || !session.firmId) {
      return [];
    }
    const result = await this.pool.query(
      `SELECT mm.id, mm.matter_id, mm.confidence, mm.state, cle.list_date, cle.list_type, cle.court_id, cle.normalized_case_number, cle.courtroom, cle.bench
       FROM matter_matches mm JOIN cause_list_entries cle ON cle.id = mm.cause_list_entry_id
       WHERE mm.firm_id = $1 ORDER BY cle.list_date DESC`,
      [session.firmId],
    );
    return mapRows<Record<string, unknown>>(result.rows);
  }

  async listUnmatchedCauseEntries(session: ProductSession, limit = 100): Promise<Array<Record<string, unknown>>> {
    if (session.actorType !== "staff" || !session.firmId) {
      return [];
    }
    const result = await this.pool.query(
      `SELECT cle.id, cle.list_date, cle.list_type, cle.court_id, cle.normalized_case_number, cle.raw_case_number, cle.courtroom, cle.bench
       FROM cause_list_entries cle
       WHERE NOT EXISTS (SELECT 1 FROM matter_matches mm WHERE mm.cause_list_entry_id = cle.id)
       ORDER BY cle.list_date DESC, cle.created_at DESC LIMIT $1`,
      [limit],
    );
    return mapRows<Record<string, unknown>>(result.rows);
  }

  async linkUnmatchedCauseEntry(session: ProductSession, entryId: string, matterId: string): Promise<Record<string, unknown> | null> {
    const firmId = await this.matterFirmId(matterId);
    if (session.actorType !== "staff" || !session.firmId || firmId !== session.firmId) {
      return null;
    }
    const matchId = randomUUID();
    const linked = await this.transaction(async (client) => {
      const entryResult = await client.query<{ court_source_id: string; list_date: string; courtroom: string | null; bench: string | null }>(
        "SELECT court_source_id, list_date, courtroom, bench FROM cause_list_entries WHERE id = $1 FOR UPDATE",
        [entryId],
      );
      const entry = entryResult.rows[0];
      if (!entry) {
        return false;
      }
      const source = getCourtSourceDefinition(entry.court_source_id);
      const match = await client.query(
        `INSERT INTO matter_matches (id, firm_id, matter_id, cause_list_entry_id, confidence, state, reviewed_by, reviewed_at)
         VALUES ($1, $2, $3, $4, 0.5, 'approved', $5, now())
         ON CONFLICT (matter_id, cause_list_entry_id) DO NOTHING`,
        [matchId, session.firmId, matterId, entryId, session.actorId],
      );
      if (match.rowCount !== 1) {
        return false;
      }
      await this.synchronizeManualCalendarItem(client, matterId, null);
      await client.query("UPDATE matters SET next_hearing_at = $1, updated_at = now() WHERE id = $2 AND firm_id = $3", [entry.list_date, matterId, session.firmId]);
      await client.query(
        `INSERT INTO calendar_items (id, matter_id, listed_at, courtroom, bench, source_type, source_confidence)
         VALUES ($1, $2, $3, $4, $5, $6, 0.5)
         ON CONFLICT (matter_id, listed_at, source_type) DO NOTHING`,
        [randomUUID(), matterId, entry.list_date, entry.courtroom, entry.bench, source?.manualReviewSourceType ?? "manual_staff"],
      );
      await this.recalculateCalendarConflicts(client, [entry.list_date]);
      return true;
    });
    return linked ? (await this.listCourtMatchReview(session)).find((match) => match.id === matchId) ?? null : null;
  }

  async reviewCourtMatch(session: ProductSession, matchId: string, state: "approved" | "rejected"): Promise<Record<string, unknown> | null> {
    if (session.actorType !== "staff" || !session.firmId) {
      return null;
    }
    const result = await this.pool.query(
      "UPDATE matter_matches SET state = $1, reviewed_by = $2, reviewed_at = now() WHERE id = $3 AND firm_id = $4",
      [state, session.actorId, matchId, session.firmId],
    );
    return result.rowCount === 1 ? (await this.listCourtMatchReview(session)).find((match) => match.id === matchId) ?? null : null;
  }

  async getNotificationPreference(session: ProductSession): Promise<NotificationPreference | null> {
    if (!session.firmId) {
      return null;
    }
    const result = await this.pool.query(
      `SELECT firm_id, actor_type, actor_id, email_enabled, sms_enabled, opted_out_at
       FROM notification_preferences WHERE firm_id = $1 AND actor_type = $2 AND actor_id = $3`,
      [session.firmId, session.actorType, session.actorId],
    );
    return result.rows[0]
      ? mapRow<NotificationPreference>(result.rows[0])
      : { firmId: session.firmId, actorType: session.actorType, actorId: session.actorId, emailEnabled: false, smsEnabled: false, optedOutAt: null };
  }

  async updateNotificationPreference(
    session: ProductSession,
    patch: { emailEnabled: boolean; smsEnabled: boolean; optedOut: boolean },
    source = "self_service",
  ): Promise<NotificationPreference | null> {
    if (!session.firmId) {
      return null;
    }
    await this.pool.query(
      `INSERT INTO notification_preferences (id, firm_id, actor_type, actor_id, email_enabled, sms_enabled, opted_out_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (firm_id, actor_type, actor_id) DO UPDATE SET email_enabled = excluded.email_enabled,
         sms_enabled = excluded.sms_enabled, opted_out_at = excluded.opted_out_at, updated_at = now()`,
      [randomUUID(), session.firmId, session.actorType, session.actorId, patch.emailEnabled, patch.smsEnabled, patch.optedOut ? nowIso() : null],
    );
    await Promise.all([
      this.setNotificationConsent(session, "email", patch.emailEnabled && !patch.optedOut, source),
      this.setNotificationConsent(session, "sms", patch.smsEnabled && !patch.optedOut, source),
    ]);
    return this.getNotificationPreference(session);
  }

  private async setNotificationConsent(
    session: ProductSession,
    channel: "email" | "sms",
    granted: boolean,
    source: string,
  ): Promise<void> {
    if (!session.firmId) {
      return;
    }
    await this.pool.query(
      `INSERT INTO notification_consents (
         id, firm_id, actor_type, actor_id, channel, status, source, granted_at, revoked_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, CASE WHEN $6 = 'granted' THEN now() END, CASE WHEN $6 = 'revoked' THEN now() END)
       ON CONFLICT (firm_id, actor_type, actor_id, channel) DO UPDATE SET
         status = excluded.status, source = excluded.source,
         granted_at = CASE WHEN excluded.status = 'granted' THEN now() ELSE notification_consents.granted_at END,
         revoked_at = CASE WHEN excluded.status = 'revoked' THEN now() ELSE NULL END,
         updated_at = now()`,
      [randomUUID(), session.firmId, session.actorType, session.actorId, channel, granted ? "granted" : "revoked", source],
    );
  }

  private async readNotificationJobs(where: string, values: unknown[] = []): Promise<NotificationJobRecord[]> {
    const result = await this.pool.query(
      `SELECT id, firm_id, actor_type, actor_id, channel, template_key, template_version, payload, scheduled_at, status, attempt_count, last_error
       FROM notification_jobs ${where}`,
      values,
    );
    return mapRows<NotificationJobRecord>(result.rows);
  }

  async listNotificationJobs(session: ProductSession): Promise<NotificationJobRecord[]> {
    return session.actorType === "staff" && session.firmId
      ? this.readNotificationJobs("WHERE firm_id = $1 ORDER BY scheduled_at DESC", [session.firmId])
      : [];
  }

  async getNotificationTemplate(job: Pick<NotificationJobRecord, "templateKey" | "channel" | "templateVersion">): Promise<NotificationTemplate | null> {
    const result = await this.pool.query(
      `SELECT template_key, channel, version, subject_template, body_template, enabled
       FROM notification_templates
       WHERE template_key = $1 AND channel = $2 AND version = $3`,
      [job.templateKey, job.channel, job.templateVersion],
    );
    return result.rows[0] ? mapRow<NotificationTemplate>(result.rows[0]) : null;
  }

  async schedulePilotNotifications(reference = new Date()): Promise<number> {
    const { agendaDate: tomorrow, scheduledAt: agendaScheduledAt } = nextDayAgendaSchedule(reference);
    await this.pool.query(
      `DELETE FROM notification_jobs nj
       WHERE nj.template_key = 'client_hearing_reminder' AND nj.status IN ('pending', 'retrying')
         AND NOT EXISTS (
           SELECT 1
           FROM matters m
           JOIN client_memberships cm ON cm.matter_id = m.id
           JOIN client_accounts c ON c.id = cm.client_account_id
           JOIN notification_consents nc ON nc.firm_id = m.firm_id AND nc.actor_type = 'client'
             AND nc.actor_id = c.id AND nc.channel = 'sms' AND nc.status = 'granted' AND nc.revoked_at IS NULL
           WHERE m.id = (nj.payload->>'matterId')::uuid AND m.firm_id = nj.firm_id AND c.id = nj.actor_id
             AND m.status = 'open' AND c.status = 'active' AND m.next_hearing_at > $1::timestamptz
             AND nj.idempotency_key = 'hearing-24h:' || m.id || ':' || c.id || ':' ||
               floor(extract(epoch FROM m.next_hearing_at))::bigint || ':sms'
         )`,
      [reference.toISOString()],
    );
    const agendaResult = await this.pool.query(
      `INSERT INTO notification_jobs (id, firm_id, actor_type, actor_id, channel, template_key, payload, idempotency_key, scheduled_at)
       SELECT gen_random_uuid(), fm.firm_id, 'staff', u.id, channels.channel, 'lawyer_next_day_agenda',
         jsonb_build_object('date', $1::date, 'matters', jsonb_agg(jsonb_build_object('id', m.id, 'rawCaseNumber', m.raw_case_number, 'title', m.title, 'nextHearingAt', m.next_hearing_at))),
         'agenda:' || $1 || ':' || u.id || ':' || channels.channel, $2
       FROM product_users u JOIN firm_memberships fm ON fm.user_id = u.id
       JOIN matters m ON m.firm_id = fm.firm_id AND m.next_hearing_at::date = $1::date
       CROSS JOIN (VALUES ('sms'), ('email')) channels(channel)
       JOIN notification_consents nc ON nc.firm_id = fm.firm_id AND nc.actor_type = 'staff'
         AND nc.actor_id = u.id AND nc.channel = channels.channel AND nc.status = 'granted' AND nc.revoked_at IS NULL
       LEFT JOIN notification_preferences np ON np.firm_id = fm.firm_id AND np.actor_type = 'staff' AND np.actor_id = u.id
       WHERE u.status = 'active' AND np.opted_out_at IS NULL
         AND (channels.channel = 'sms' AND COALESCE(np.sms_enabled, true) OR channels.channel = 'email' AND u.email IS NOT NULL AND COALESCE(np.email_enabled, true))
       GROUP BY fm.firm_id, u.id, channels.channel
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [tomorrow, agendaScheduledAt],
    );
    const clientResult = await this.pool.query(
      `INSERT INTO notification_jobs (id, firm_id, actor_type, actor_id, channel, template_key, payload, idempotency_key, scheduled_at)
       SELECT gen_random_uuid(), m.firm_id, 'client', c.id, 'sms', 'client_hearing_reminder',
         jsonb_build_object('matterId', m.id, 'rawCaseNumber', m.raw_case_number, 'title', m.title, 'nextHearingAt', m.next_hearing_at),
         'hearing-24h:' || m.id || ':' || c.id || ':' || floor(extract(epoch FROM m.next_hearing_at))::bigint || ':sms',
         m.next_hearing_at - interval '24 hours'
       FROM client_accounts c JOIN client_memberships cm ON cm.client_account_id = c.id JOIN matters m ON m.id = cm.matter_id
       JOIN notification_consents nc ON nc.firm_id = m.firm_id AND nc.actor_type = 'client'
         AND nc.actor_id = c.id AND nc.channel = 'sms' AND nc.status = 'granted' AND nc.revoked_at IS NULL
       LEFT JOIN notification_preferences np ON np.firm_id = m.firm_id AND np.actor_type = 'client' AND np.actor_id = c.id
       WHERE m.next_hearing_at > $1::timestamptz AND m.status = 'open' AND c.status = 'active'
         AND np.opted_out_at IS NULL AND COALESCE(np.sms_enabled, true)
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [reference.toISOString()],
    );
    return (agendaResult.rowCount ?? 0) + (clientResult.rowCount ?? 0);
  }

  async claimDueNotificationJobs(limit = 20): Promise<NotificationJobRecord[]> {
    return this.transaction(async (client) => {
      const result = await client.query(
        `SELECT id, firm_id, actor_type, actor_id, channel, template_key, template_version, payload, scheduled_at, status, attempt_count, last_error
         FROM notification_jobs
         WHERE status IN ('pending', 'retrying') AND scheduled_at <= now() AND attempt_count < 3
         ORDER BY scheduled_at LIMIT $1 FOR UPDATE SKIP LOCKED`,
        [limit],
      );
      const ids = result.rows.map((row) => row.id);
      if (ids.length > 0) {
        await client.query("UPDATE notification_jobs SET status = 'processing' WHERE id = ANY($1::uuid[])", [ids]);
      }
      return mapRows<NotificationJobRecord>(result.rows);
    });
  }

  async getNotificationRecipient(job: NotificationJobRecord): Promise<{ phone: string | null; email: string | null } | null> {
    const result = job.actorType === "staff"
      ? await this.pool.query(
        `SELECT u.phone, u.email
         FROM product_users u
         JOIN firm_memberships fm ON fm.user_id = u.id AND fm.firm_id = $2
         JOIN notification_consents nc ON nc.firm_id = $2 AND nc.actor_type = 'staff'
           AND nc.actor_id = u.id AND nc.channel = $3 AND nc.status = 'granted' AND nc.revoked_at IS NULL
         LEFT JOIN notification_preferences np
           ON np.firm_id = $2 AND np.actor_type = 'staff' AND np.actor_id = u.id
         WHERE u.id = $1 AND u.status = 'active' AND np.opted_out_at IS NULL
           AND ($3 = 'sms' AND COALESCE(np.sms_enabled, true)
             OR $3 = 'email' AND u.email IS NOT NULL AND COALESCE(np.email_enabled, true))`,
        [job.actorId, job.firmId, job.channel],
      )
      : await this.pool.query(
        `SELECT c.phone, NULL::text AS email
         FROM client_accounts c
         JOIN notification_consents nc ON nc.firm_id = $2 AND nc.actor_type = 'client'
           AND nc.actor_id = c.id AND nc.channel = $3 AND nc.status = 'granted' AND nc.revoked_at IS NULL
         LEFT JOIN notification_preferences np
           ON np.firm_id = $2 AND np.actor_type = 'client' AND np.actor_id = c.id
         WHERE c.id = $1 AND c.firm_id = $2 AND c.status = 'active' AND np.opted_out_at IS NULL
           AND $3 = 'sms' AND COALESCE(np.sms_enabled, true)`,
        [job.actorId, job.firmId, job.channel],
      );
    return result.rows[0] ?? null;
  }

  async recordNotificationAttempt(jobId: string, input: { providerId: string | null; error: string | null }): Promise<void> {
    await this.transaction(async (client) => {
      const result = await client.query<{ attempt_count: number }>("SELECT attempt_count FROM notification_jobs WHERE id = $1 FOR UPDATE", [jobId]);
      if (!result.rows[0]) {
        return;
      }
      const status = input.error ? (result.rows[0].attempt_count + 1 >= 3 ? "failed" : "retrying") : "sent";
      await client.query(
        "UPDATE notification_jobs SET status = $1, attempt_count = attempt_count + 1, last_error = $2 WHERE id = $3",
        [status, input.error, jobId],
      );
      await client.query(
        "INSERT INTO notification_attempts (id, job_id, provider_id, status, error) VALUES ($1, $2, $3, $4, $5)",
        [randomUUID(), jobId, input.providerId, status, input.error],
      );
    });
  }

  async listAlerts(session: ProductSession): Promise<ProductAlert[]> {
    if (session.actorType !== "staff" || !session.firmId) {
      return [];
    }
    const result = await this.pool.query("SELECT id, firm_id, type, title, body, created_at, read_at FROM alerts WHERE firm_id = $1 ORDER BY created_at DESC", [session.firmId]);
    return mapRows<ProductAlert>(result.rows);
  }

  async markAlertRead(session: ProductSession, id: string): Promise<ProductAlert | null> {
    if (session.actorType !== "staff" || !session.firmId) {
      return null;
    }
    const result = await this.pool.query(
      "UPDATE alerts SET read_at = now() WHERE id = $1 AND firm_id = $2 RETURNING id, firm_id, type, title, body, created_at, read_at",
      [id, session.firmId],
    );
    return result.rows[0] ? mapRow<ProductAlert>(result.rows[0]) : null;
  }

  async listAuditEvents(session: ProductSession): Promise<AuditEvent[]> {
    if (session.actorType !== "staff" || !session.firmId) {
      return [];
    }
    const result = await this.pool.query(
      "SELECT id, firm_id, actor_type, actor_id, object_type, object_id, event_type, payload, created_at FROM audit_events WHERE firm_id = $1 ORDER BY created_at DESC LIMIT 200",
      [session.firmId],
    );
    return mapRows<AuditEvent>(result.rows);
  }

  async recordApiMutation(session: ProductSession, method: string, route: string, statusCode: number): Promise<void> {
    if (!session.firmId) {
      return;
    }
    await this.pool.query(
      `INSERT INTO audit_events (id, firm_id, actor_type, actor_id, object_type, object_id, event_type, payload)
       VALUES ($1, $2, $3, $4, 'api_route', $5, 'api.mutation', $6)`,
      [randomUUID(), session.firmId, session.actorType, session.actorId, route, JSON.stringify({ method, statusCode })],
    );
  }

  async recordSecurityEvent(
    session: ProductSession,
    eventType: string,
    objectType: string,
    objectId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    if (!session.firmId) {
      return;
    }
    await this.pool.query(
      `INSERT INTO audit_events (id, firm_id, actor_type, actor_id, object_type, object_id, event_type, payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [randomUUID(), session.firmId, session.actorType, session.actorId, objectType, objectId, eventType, JSON.stringify(payload)],
    );
  }

  async search(session: ProductSession, query: string): Promise<SearchHit[]> {
    const q = query.trim().toLowerCase();
    if (!q) {
      return [];
    }
    const [matters, documents, clients] = await Promise.all([
      this.listMatters(session),
      this.listDocuments(session),
      session.actorType === "staff" ? this.listClients(session) : Promise.resolve([]),
    ]);
    return [
      ...matters.filter((matter) => `${matter.rawCaseNumber} ${matter.title}`.toLowerCase().includes(q)).map<SearchHit>((matter) => ({ id: matter.id, kind: "matter", title: matter.rawCaseNumber, subtitle: matter.title })),
      ...documents.filter((document) => `${document.title} ${document.searchText ?? ""}`.toLowerCase().includes(q)).map<SearchHit>((document) => ({ id: document.id, kind: "document", title: document.title, subtitle: document.type })),
      ...clients.filter((client) => `${client.displayName} ${client.phone}`.toLowerCase().includes(q)).map<SearchHit>((client) => ({ id: client.id, kind: "client", title: client.displayName, subtitle: client.phone })),
    ].slice(0, 20);
  }

  async getOverviewReport(session: ProductSession): Promise<OverviewReport | null> {
    if (session.actorType !== "staff" || !session.firmId) {
      return null;
    }
    const [matters, alerts, syncHealth] = await Promise.all([this.listMatters(session), this.listAlerts(session), this.listCourtSources()]);
    const stageCounts = new Map<string, number>();
    for (const matter of matters) {
      stageCounts.set(matter.stage, (stageCounts.get(matter.stage) ?? 0) + 1);
    }
    const now = Date.now();
    const boundary = now + 7 * 24 * 60 * 60 * 1000;
    return {
      metrics: {
        openMatters: matters.filter((matter) => matter.status === "open").length,
        upcomingHearings: matters.filter((matter) => matter.nextHearingAt && new Date(matter.nextHearingAt).getTime() >= now && new Date(matter.nextHearingAt).getTime() <= boundary).length,
        unreadAlerts: alerts.filter((alert) => !alert.readAt).length,
        outstandingInvoiceTotal: 0,
        overdueInvoiceTotal: 0,
        billableMinutes: 0,
      },
      mattersByStage: [...stageCounts].map(([stage, count]) => ({ stage, count })).sort((left, right) => right.count - left.count),
      syncHealth,
    };
  }

  async listTimeEntries(): Promise<TimeEntry[]> {
    return [];
  }

  async createTimeEntry(): Promise<null> {
    return null;
  }

  async listInvoices(): Promise<Invoice[]> {
    return [];
  }

  async createInvoice(): Promise<null> {
    return null;
  }

  async updateInvoice(): Promise<null> {
    return null;
  }

  async recordCourtSync(id: string): Promise<(CourtSource & { metrics: Record<string, number> }) | null> {
    return (await this.listCourtSources()).find((source) => source.id === id) ?? null;
  }

  async listIngestionRuns(): Promise<IngestionRun[]> {
    const result = await this.pool.query(
      `SELECT id, court_source_id, court_id, status, rows_fetched, rows_parsed, rows_matched, parser_failures,
        unmatched_count, note, started_at, finished_at
       FROM ingestion_runs ORDER BY finished_at DESC`,
    );
    return mapRows<IngestionRun>(result.rows);
  }

  async recordCourtIngestionFailure(sourceId: string, listType: CourtListType, error: string): Promise<void> {
    const source = getCourtSourceDefinition(sourceId);
    if (!source) {
      throw new Error(`Unsupported court source: ${sourceId}`);
    }
    await this.transaction(async (client) => {
      await client.query(
        `INSERT INTO ingestion_runs (id, court_source_id, court_id, status, rows_fetched, rows_parsed, rows_matched,
          parser_failures, unmatched_count, note, started_at, finished_at)
         VALUES ($1, $2, $3, 'needs_review', 0, 0, 0, 1, 0, $4, now(), now())`,
        [randomUUID(), sourceId, source.courtId, `${listType}: ${error}`.slice(0, 1000)],
      );
      await client.query("UPDATE court_sources SET status = 'degraded' WHERE id = $1", [sourceId]);
    });
  }

  async recordIhcIngestionFailure(listType: CourtListType, error: string): Promise<void> {
    await this.recordCourtIngestionFailure("source-ihc", listType, error);
  }

  readSeedAsset(): null {
    return null;
  }
}

export function createPostgresProductStore(connectionString = process.env.DATABASE_URL): PostgresProductStore {
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for the PostgreSQL product store");
  }
  return new PostgresProductStore(connectionString);
}
