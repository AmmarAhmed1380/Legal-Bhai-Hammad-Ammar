import { mkdirSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  type CalendarEntry,
  type CaseRecord,
  type HearingLog,
  type NotificationPreview,
  type NotificationType,
  PALETTE,
  type ShareLink,
  type SourceType,
  type Stage,
  type User,
} from "@wakeel/shared";

export interface CalendarEntryWithCase extends CalendarEntry {
  caseTitle: string;
  rawCaseNumber: string;
  stage: Stage;
  sourceLabel: string;
}

export interface CaseDetail extends CaseRecord {
  assignedUser: User | null;
  hearings: HearingLog[];
}

export interface SharedCasePayload {
  caseRecord: CaseRecord;
  latestHearing: HearingLog | null;
}

export interface CalendarTodayPayload {
  date: string;
  entries: CalendarEntryWithCase[];
  lastSyncedAt: string | null;
}

export interface UploadOwner {
  hearingId: string;
  caseId: string;
}

interface CreateCaseInput {
  rawCaseNumber: string;
  normalizedCaseNumber: string;
  court: string;
  title: string;
  stage: Stage;
  nextDate: string | null;
  assignedToUserId: string | null;
  clientName: string;
  clientPhone: string;
  sourceType: SourceType;
  judgeName: string | null;
  benchName: string | null;
}

interface UpdateCaseInput extends Partial<CreateCaseInput> {}

interface HearingInput {
  hearingDate: string;
  outcome: string;
  notes: string;
  nextDateGiven: string | null;
  stageAfter: Stage | null;
  imageUrl: string | null;
  mimeType: string | null;
  ocrText: string | null;
  ocrStatus: HearingLog["ocrStatus"];
}

interface LiveEntryInput {
  caseId: string;
  court: string;
  bench: string;
  date: string;
  timeSlot: string;
  source: SourceType;
  sourceConfidence: number;
  judgeNames: string | null;
}

interface SeededCalendarEntry extends LiveEntryInput {
  isSeeded: boolean;
}

function nowIso(): string {
  return new Date().toISOString();
}

function localDateInPakistan(date = new Date()): string {
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" });
}

function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export class DemoStore {
  readonly db: DatabaseSync;

  constructor(dbPath: string, options: { seed?: boolean } = {}) {
    if (dbPath !== ":memory:") {
      mkdirSync(dirname(dbPath), { recursive: true });
    }
    this.db = new DatabaseSync(dbPath);
    this.db.exec("PRAGMA foreign_keys = ON;");
    this.setup();
    if (options.seed ?? process.env.NODE_ENV !== "production") {
      this.seed();
    }
  }

  private setup(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        phone TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        firm_id TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS cases (
        id TEXT PRIMARY KEY,
        raw_case_number TEXT NOT NULL,
        normalized_case_number TEXT NOT NULL,
        court TEXT NOT NULL,
        title TEXT NOT NULL,
        stage TEXT NOT NULL,
        next_date TEXT,
        assigned_to_user_id TEXT,
        client_name TEXT NOT NULL,
        client_phone TEXT NOT NULL,
        source_type TEXT NOT NULL,
        judge_name TEXT,
        bench_name TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS hearings (
        id TEXT PRIMARY KEY,
        case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
        hearing_date TEXT NOT NULL,
        outcome TEXT NOT NULL,
        notes TEXT NOT NULL,
        next_date_given TEXT,
        stage_after TEXT,
        image_url TEXT,
        mime_type TEXT,
        ocr_text TEXT,
        ocr_status TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS calendar_entries (
        id TEXT PRIMARY KEY,
        case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
        court TEXT NOT NULL,
        bench TEXT NOT NULL,
        date TEXT NOT NULL,
        time_slot TEXT NOT NULL,
        source TEXT NOT NULL,
        source_confidence REAL NOT NULL,
        judge_names TEXT,
        synced_at TEXT NOT NULL,
        is_seeded INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS share_links (
        id TEXT PRIMARY KEY,
        case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS notification_previews (
        id TEXT PRIMARY KEY,
        case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        channel TEXT NOT NULL,
        rendered_text TEXT NOT NULL,
        recipient TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    this.ensureCalendarSeedColumn();
  }

  private ensureCalendarSeedColumn(): void {
    const columns = this.db.prepare("PRAGMA table_info(calendar_entries)").all() as Array<{ name: string }>;
    if (columns.some((column) => column.name === "is_seeded")) {
      return;
    }

    this.db.exec("ALTER TABLE calendar_entries ADD COLUMN is_seeded INTEGER NOT NULL DEFAULT 0");
    this.db.exec("UPDATE calendar_entries SET is_seeded = 1");
  }

  private clearAllData(): void {
    this.db.exec(`
      DELETE FROM notification_previews;
      DELETE FROM share_links;
      DELETE FROM calendar_entries;
      DELETE FROM hearings;
      DELETE FROM cases;
      DELETE FROM users;
    `);
  }

  private seed(): void {
    const userCount = this.db.prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number };
    if (userCount.count > 0) {
      return;
    }

    const createdAt = nowIso();
    const users: User[] = [
      { id: "user-admin", phone: "03001234567", name: "Zo Ahmed", role: "admin", firmId: "firm-demo" },
      { id: "user-associate", phone: "03007654321", name: "Areeb Khan", role: "associate", firmId: "firm-demo" },
      { id: "user-junior", phone: "03001112222", name: "Hira Malik", role: "junior", firmId: "firm-demo" },
    ];
    const insertUser = this.db.prepare(`
      INSERT INTO users (id, phone, name, role, firm_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const user of users) {
      insertUser.run(user.id, user.phone, user.name, user.role, user.firmId, createdAt);
    }

    const today = localDateInPakistan();
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextDate = localDateInPakistan(nextWeek);

    const cases: CreateCaseInput[] = [
      {
        rawCaseNumber: "W.P. 2076/2019",
        normalizedCaseNumber: "WRIT PETITION 2076/2019",
        court: "Islamabad High Court",
        title: "Redtone Telecommunications Pak Pvt Ltd v CIR etc",
        stage: "notice",
        nextDate,
        assignedToUserId: "user-admin",
        clientName: "Redtone Telecom",
        clientPhone: "03005550001",
        sourceType: "live_ihc",
        judgeName: "Justice Muhammad Azam Khan / Justice Inaam Ameen Minhas",
        benchName: "Court No: 8",
      },
      {
        rawCaseNumber: "Civil Suit 112/2026",
        normalizedCaseNumber: "CIVIL SUIT 112/2026",
        court: "Islamabad District Court East",
        title: "Farooq Traders v Rizwan Builders",
        stage: "evidence",
        nextDate,
        assignedToUserId: "user-associate",
        clientName: "Farooq Traders",
        clientPhone: "03005550002",
        sourceType: "demo_district",
        judgeName: "Civil Judge East-I",
        benchName: "Room 12",
      },
      {
        rawCaseNumber: "Criminal Revision 77/2026",
        normalizedCaseNumber: "CRIMINAL REVISION 77/2026",
        court: "Rawalpindi District & Sessions",
        title: "State v Qasim Ali",
        stage: "arguments",
        nextDate,
        assignedToUserId: "user-junior",
        clientName: "Qasim Ali",
        clientPhone: "03005550003",
        sourceType: "demo_district",
        judgeName: "Additional Sessions Judge-III",
        benchName: "Courtroom 4",
      },
    ];
    const createdIds = cases.map((caseInput) => this.createCase(caseInput));

    this.addCalendarEntries(
      [
        {
          caseId: createdIds[0],
          court: "Islamabad High Court",
          bench: "Court No: 8",
          date: today,
          timeSlot: "09:30 AM",
          source: "live_ihc",
          sourceConfidence: 0.66,
          judgeNames: "Justice Muhammad Azam Khan / Justice Inaam Ameen Minhas",
          isSeeded: true,
        },
        {
          caseId: createdIds[1],
          court: "Islamabad District Court East",
          bench: "Room 12",
          date: today,
          timeSlot: "11:00 AM",
          source: "demo_district",
          sourceConfidence: 1,
          judgeNames: "Civil Judge East-I",
          isSeeded: true,
        },
        {
          caseId: createdIds[2],
          court: "Rawalpindi District & Sessions",
          bench: "Courtroom 4",
          date: today,
          timeSlot: "11:00 AM",
          source: "demo_district",
          sourceConfidence: 1,
          judgeNames: "Additional Sessions Judge-III",
          isSeeded: true,
        },
      ],
      false,
    );
  }

  close(): void {
    this.db.close();
  }

  resetDemoData(): string {
    this.clearAllData();
    this.seed();
    return nowIso();
  }

  listUsers(): User[] {
    return this.db
      .prepare("SELECT id, phone, name, role, firm_id AS firmId FROM users ORDER BY name")
      .all() as unknown as User[];
  }

  findUserByPhone(phone: string): User | null {
    const row = this.db
      .prepare("SELECT id, phone, name, role, firm_id AS firmId FROM users WHERE phone = ?")
      .get(phone) as User | undefined;
    return row ?? null;
  }

  getUserById(id: string): User | null {
    const row = this.db
      .prepare("SELECT id, phone, name, role, firm_id AS firmId FROM users WHERE id = ?")
      .get(id) as User | undefined;
    return row ?? null;
  }

  listCases(): CaseRecord[] {
    return this.db
      .prepare(`
        SELECT
          id,
          raw_case_number AS rawCaseNumber,
          normalized_case_number AS normalizedCaseNumber,
          court,
          title,
          stage,
          next_date AS nextDate,
          assigned_to_user_id AS assignedToUserId,
          client_name AS clientName,
          client_phone AS clientPhone,
          source_type AS sourceType,
          judge_name AS judgeName,
          bench_name AS benchName
        FROM cases
        ORDER BY next_date IS NULL, next_date, court, raw_case_number
      `)
      .all() as unknown as CaseRecord[];
  }

  getCaseRecord(id: string): CaseRecord | null {
    const caseRecord = this.db
      .prepare(`
        SELECT
          id,
          raw_case_number AS rawCaseNumber,
          normalized_case_number AS normalizedCaseNumber,
          court,
          title,
          stage,
          next_date AS nextDate,
          assigned_to_user_id AS assignedToUserId,
          client_name AS clientName,
          client_phone AS clientPhone,
          source_type AS sourceType,
          judge_name AS judgeName,
          bench_name AS benchName
        FROM cases
        WHERE id = ?
      `)
      .get(id) as CaseRecord | undefined;

    return caseRecord ?? null;
  }

  getCase(id: string): CaseDetail | null {
    const caseRecord = this.getCaseRecord(id);
    if (!caseRecord) {
      return null;
    }

    const hearings = this.db
      .prepare(`
        SELECT
          id,
          case_id AS caseId,
          hearing_date AS hearingDate,
          outcome,
          notes,
          next_date_given AS nextDateGiven,
          image_url AS imageUrl,
          ocr_text AS ocrText,
          ocr_status AS ocrStatus,
          stage_after AS stageAfter
        FROM hearings
        WHERE case_id = ?
        ORDER BY hearing_date DESC, created_at DESC
      `)
      .all(id) as unknown as HearingLog[];

    return {
      ...caseRecord,
      assignedUser: caseRecord.assignedToUserId ? this.getUserById(caseRecord.assignedToUserId) : null,
      hearings,
    };
  }

  createCase(input: CreateCaseInput): string {
    const id = randomUUID();
    const timestamp = nowIso();
    this.db
      .prepare(`
        INSERT INTO cases (
          id,
          raw_case_number,
          normalized_case_number,
          court,
          title,
          stage,
          next_date,
          assigned_to_user_id,
          client_name,
          client_phone,
          source_type,
          judge_name,
          bench_name,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        id,
        input.rawCaseNumber,
        input.normalizedCaseNumber,
        input.court,
        input.title,
        input.stage,
        input.nextDate,
        input.assignedToUserId,
        input.clientName,
        input.clientPhone,
        input.sourceType,
        input.judgeName,
        input.benchName,
        timestamp,
        timestamp,
      );
    return id;
  }

  updateCase(id: string, input: UpdateCaseInput): CaseRecord | null {
    const existing = this.getCaseRecord(id);
    if (!existing) {
      return null;
    }

    const merged: CreateCaseInput = {
      rawCaseNumber: input.rawCaseNumber ?? existing.rawCaseNumber,
      normalizedCaseNumber: input.normalizedCaseNumber ?? existing.normalizedCaseNumber,
      court: input.court ?? existing.court,
      title: input.title ?? existing.title,
      stage: input.stage ?? existing.stage,
      nextDate: input.nextDate ?? existing.nextDate,
      assignedToUserId: input.assignedToUserId ?? existing.assignedToUserId,
      clientName: input.clientName ?? existing.clientName,
      clientPhone: input.clientPhone ?? existing.clientPhone,
      sourceType: input.sourceType ?? existing.sourceType,
      judgeName: input.judgeName ?? existing.judgeName,
      benchName: input.benchName ?? existing.benchName,
    };

    this.db
      .prepare(`
        UPDATE cases
        SET
          raw_case_number = ?,
          normalized_case_number = ?,
          court = ?,
          title = ?,
          stage = ?,
          next_date = ?,
          assigned_to_user_id = ?,
          client_name = ?,
          client_phone = ?,
          source_type = ?,
          judge_name = ?,
          bench_name = ?,
          updated_at = ?
        WHERE id = ?
      `)
      .run(
        merged.rawCaseNumber,
        merged.normalizedCaseNumber,
        merged.court,
        merged.title,
        merged.stage,
        merged.nextDate,
        merged.assignedToUserId,
        merged.clientName,
        merged.clientPhone,
        merged.sourceType,
        merged.judgeName,
        merged.benchName,
        nowIso(),
        id,
      );

    return this.getCaseRecord(id);
  }

  assignCase(caseId: string, userId: string): CaseRecord | null {
    return this.updateCase(caseId, { assignedToUserId: userId });
  }

  addHearing(caseId: string, input: HearingInput): HearingLog {
    const id = randomUUID();
    this.db
      .prepare(`
        INSERT INTO hearings (
          id,
          case_id,
          hearing_date,
          outcome,
          notes,
          next_date_given,
          stage_after,
          image_url,
          mime_type,
          ocr_text,
          ocr_status,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        id,
        caseId,
        input.hearingDate,
        input.outcome,
        input.notes,
        input.nextDateGiven,
        input.stageAfter,
        input.imageUrl,
        input.mimeType,
        input.ocrText,
        input.ocrStatus,
        nowIso(),
      );

    const existing = this.getCaseRecord(caseId);
    if (existing) {
      this.updateCase(caseId, {
        nextDate: input.nextDateGiven ?? existing.nextDate,
        stage: input.stageAfter ?? existing.stage,
      });
    }

    return this.db
      .prepare(`
        SELECT
          id,
          case_id AS caseId,
          hearing_date AS hearingDate,
          outcome,
          notes,
          next_date_given AS nextDateGiven,
          image_url AS imageUrl,
          ocr_text AS ocrText,
          ocr_status AS ocrStatus,
          stage_after AS stageAfter
        FROM hearings
        WHERE id = ?
      `)
      .get(id) as unknown as HearingLog;
  }

  getUploadOwner(filename: string): UploadOwner | null {
    const relativePath = `/uploads/${filename}`;
    const row = this.db
      .prepare(`
        SELECT id AS hearingId, case_id AS caseId
        FROM hearings
        WHERE image_url = ? OR image_url LIKE ?
        LIMIT 1
      `)
      .get(relativePath, `%${relativePath}`) as UploadOwner | undefined;

    return row ?? null;
  }

  getDashboardSummary(date = localDateInPakistan()): {
    totalCases: number;
    todayHearings: number;
    conflicts: number;
    assignedLawyers: number;
  } {
    const totalCases = (this.db.prepare("SELECT COUNT(*) AS count FROM cases").get() as { count: number }).count;
    const calendar = this.listCalendarForDate(date);
    const assignedLawyers = (
      this.db
        .prepare("SELECT COUNT(DISTINCT assigned_to_user_id) AS count FROM cases WHERE assigned_to_user_id IS NOT NULL")
        .get() as { count: number }
    ).count;

    return {
      totalCases,
      todayHearings: calendar.length,
      conflicts: calendar.filter((entry) => entry.isConflict).length,
      assignedLawyers,
    };
  }

  listCalendarForDate(date = localDateInPakistan()): CalendarEntryWithCase[] {
    const rows = this.db
      .prepare(`
        SELECT
          ce.id,
          ce.case_id AS caseId,
          ce.court,
          ce.bench,
          ce.date,
          ce.time_slot AS timeSlot,
          ce.source,
          ce.source_confidence AS sourceConfidence,
          ce.judge_names AS judgeNames,
          c.title AS caseTitle,
          c.raw_case_number AS rawCaseNumber,
          c.stage
        FROM calendar_entries ce
        JOIN cases c ON c.id = ce.case_id
        WHERE ce.date = ?
        ORDER BY ce.time_slot, ce.court
      `)
      .all(date) as unknown as Array<
      CalendarEntry & {
        caseTitle: string;
        rawCaseNumber: string;
        stage: Stage;
      }
    >;

    const conflictsByTime = rows.reduce<Record<string, number>>((accumulator, row) => {
      accumulator[row.timeSlot] = (accumulator[row.timeSlot] ?? 0) + 1;
      return accumulator;
    }, {});

    return rows.map((row) => ({
      ...row,
      isConflict: (conflictsByTime[row.timeSlot] ?? 0) > 1,
      sourceLabel: row.source === "live_ihc" ? "IHC Live" : "District Demo",
    }));
  }

  getLatestLiveIhcSyncTime(): string | null {
    const row = this.db
      .prepare(`
        SELECT MAX(synced_at) AS lastSyncedAt
        FROM calendar_entries
        WHERE source = 'live_ihc' AND is_seeded = 0
      `)
      .get() as { lastSyncedAt: string | null };

    return row.lastSyncedAt ?? null;
  }

  getCalendarTodayPayload(date = localDateInPakistan()): CalendarTodayPayload {
    return {
      date,
      entries: this.listCalendarForDate(date),
      lastSyncedAt: this.getLatestLiveIhcSyncTime(),
    };
  }

  addCalendarEntries(entries: SeededCalendarEntry[] | LiveEntryInput[], replaceLiveForDate: boolean, isSeeded = false): void {
    if (entries.length === 0) {
      return;
    }

    if (replaceLiveForDate) {
      const dates = [...new Set(entries.filter((entry) => entry.source === "live_ihc").map((entry) => entry.date))];
      for (const date of dates) {
        this.db.prepare("DELETE FROM calendar_entries WHERE source = 'live_ihc' AND date = ?").run(date);
      }
    }

    const insert = this.db.prepare(`
      INSERT INTO calendar_entries (
        id,
        case_id,
        court,
        bench,
        date,
        time_slot,
        source,
        source_confidence,
        judge_names,
        synced_at,
        is_seeded
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const entry of entries) {
      const seededFlag = "isSeeded" in entry ? entry.isSeeded : isSeeded;
      insert.run(
        randomUUID(),
        entry.caseId,
        entry.court,
        entry.bench,
        entry.date,
        entry.timeSlot,
        entry.source,
        entry.sourceConfidence,
        entry.judgeNames,
        nowIso(),
        seededFlag ? 1 : 0,
      );
    }
  }

  listIhcCases(): CaseRecord[] {
    return this.db
      .prepare(`
        SELECT
          id,
          raw_case_number AS rawCaseNumber,
          normalized_case_number AS normalizedCaseNumber,
          court,
          title,
          stage,
          next_date AS nextDate,
          assigned_to_user_id AS assignedToUserId,
          client_name AS clientName,
          client_phone AS clientPhone,
          source_type AS sourceType,
          judge_name AS judgeName,
          bench_name AS benchName
        FROM cases
        WHERE source_type = 'live_ihc'
      `)
      .all() as unknown as CaseRecord[];
  }

  createShareLink(caseId: string, token: string, expiresAt: string): { rawToken: string; link: ShareLink } {
    const linkId = randomUUID();
    const tokenHash = hashValue(token);
    this.db
      .prepare(`
        INSERT INTO share_links (id, case_id, token_hash, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?)
      `)
      .run(linkId, caseId, tokenHash, expiresAt, nowIso());

    return {
      rawToken: token,
      link: {
        id: linkId,
        caseId,
        tokenHash,
        expiresAt,
      },
    };
  }

  getSharedCaseByToken(token: string): SharedCasePayload | null {
    const link = this.db
      .prepare(`
        SELECT case_id AS caseId, expires_at AS expiresAt
        FROM share_links
        WHERE token_hash = ?
      `)
      .get(hashValue(token)) as { caseId: string; expiresAt: string } | undefined;

    if (!link || new Date(link.expiresAt).getTime() < Date.now()) {
      return null;
    }

    const caseRecord = this.getCase(link.caseId);
    if (!caseRecord) {
      return null;
    }

    return {
      caseRecord,
      latestHearing: caseRecord.hearings[0] ?? null,
    };
  }

  saveNotificationPreview(caseId: string, type: NotificationType, renderedText: string, recipient: string): NotificationPreview {
    const id = randomUUID();
    this.db
      .prepare(`
        INSERT INTO notification_previews (id, case_id, type, channel, rendered_text, recipient, created_at)
        VALUES (?, ?, ?, 'sms_preview', ?, ?, ?)
      `)
      .run(id, caseId, type, renderedText, recipient, nowIso());

    return {
      id,
      caseId,
      type,
      channel: "sms_preview",
      renderedText,
      recipient,
    };
  }
}

export function createStore(dbPath = process.env.DEMO_DB_PATH ?? join(process.cwd(), "data", "legalbahi-demo.sqlite")): DemoStore {
  return new DemoStore(dbPath, { seed: process.env.NODE_ENV !== "production" });
}

export function todayInPakistan(): string {
  return localDateInPakistan();
}

export const themeTokens = PALETTE;
