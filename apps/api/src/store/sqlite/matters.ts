import { randomUUID } from "node:crypto";

import type { Matter, MatterParty, ProductSession } from "@wakeel/shared";
import { normalizeCourtCaseNumber } from "../../lib/court-sources.js";
import type { ValidatedMatterCsvRow } from "../../lib/csv-import.js";

import type { CreateMatterInput, CsvImportPreview, MatterDetail } from "../types.js";
import { decodeJson, encodeJson, nowIso } from "../utils.js";
import type { SqliteStoreCore } from "./core.js";

export const matterMethods = {
  listMatters(this: SqliteStoreCore, session: ProductSession): Matter[] {
    if (session.actorType === "staff") {
      return this.db
        .prepare(`
          SELECT
            id,
            firm_id AS firmId,
            court_id AS courtId,
            raw_case_number AS rawCaseNumber,
            normalized_case_number AS normalizedCaseNumber,
            title,
            matter_type AS matterType,
            stage,
            status,
            next_hearing_at AS nextHearingAt,
            lead_lawyer_id AS leadLawyerId
          FROM matters
          WHERE firm_id = ?
          ORDER BY next_hearing_at IS NULL, next_hearing_at, title
        `)
        .all(session.firmId) as unknown as Matter[];
    }

    return this.db
      .prepare(`
        SELECT
          m.id,
          m.firm_id AS firmId,
          m.court_id AS courtId,
          m.raw_case_number AS rawCaseNumber,
          m.normalized_case_number AS normalizedCaseNumber,
          m.title,
          m.matter_type AS matterType,
          m.stage,
          m.status,
          m.next_hearing_at AS nextHearingAt,
          m.lead_lawyer_id AS leadLawyerId
        FROM matters m
        JOIN client_memberships cm ON cm.matter_id = m.id
        WHERE cm.client_account_id = ?
        ORDER BY m.next_hearing_at IS NULL, m.next_hearing_at, m.title
      `)
      .all(session.actorId) as unknown as Matter[];
  },

  getMatter(this: SqliteStoreCore, session: ProductSession, matterId: string): MatterDetail | null {
    const base = this.db
      .prepare(`
        SELECT
          id,
          firm_id AS firmId,
          court_id AS courtId,
          raw_case_number AS rawCaseNumber,
          normalized_case_number AS normalizedCaseNumber,
          title,
          matter_type AS matterType,
          stage,
          status,
          next_hearing_at AS nextHearingAt,
          lead_lawyer_id AS leadLawyerId
        FROM matters
        WHERE id = ?
      `)
      .get(matterId) as unknown as Matter | undefined;

    if (!base || !this.canAccessMatter(session, base.id, base.firmId)) {
      return null;
    }

    const leadLawyer = base.leadLawyerId ? this.getStaffUser(base.leadLawyerId) : null;
    const parties = this.db
      .prepare(
        "SELECT id, matter_id AS matterId, party_type AS partyType, display_name AS displayName, contact_ref AS contactRef FROM matter_parties WHERE matter_id = ? ORDER BY created_at",
      )
      .all(matterId) as unknown as MatterDetail["parties"];
    const hearings = this.listHearings(session, matterId);
    const documents = this.listDocuments(session, { matterId });
    const thread = this.db
      .prepare("SELECT id, matter_id AS matterId, participant_type AS participantType, status FROM message_threads WHERE matter_id = ?")
      .get(matterId) as MatterDetail["thread"] | undefined;

    return {
      ...base,
      leadLawyer,
      parties,
      hearings,
      documents,
      thread: thread ?? null,
    };
  },

  createMatter(this: SqliteStoreCore, session: ProductSession, input: CreateMatterInput): Matter | null {
    if (session.actorType !== "staff" || !session.firmId || session.firmId !== input.firmId) {
      return null;
    }
    if (input.leadLawyerId && !this.staffBelongsToFirm(input.leadLawyerId, input.firmId)) {
      return null;
    }
    const matter: Matter = {
      id: randomUUID(),
      ...input,
      normalizedCaseNumber: input.normalizedCaseNumber || normalizeCourtCaseNumber(input.courtId, input.rawCaseNumber),
    };
    this.db
      .prepare(`
        INSERT INTO matters (
          id, firm_id, court_id, raw_case_number, normalized_case_number, title, matter_type, stage, status, next_hearing_at, lead_lawyer_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        matter.id,
        matter.firmId,
        matter.courtId,
        matter.rawCaseNumber,
        matter.normalizedCaseNumber,
        matter.title,
        matter.matterType,
        matter.stage,
        matter.status,
        matter.nextHearingAt,
        matter.leadLawyerId,
        nowIso(),
        nowIso(),
      );
    this.db
      .prepare("INSERT INTO message_threads (id, matter_id, participant_type, status, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(randomUUID(), matter.id, "firm_client", "open", nowIso());
    this.synchronizeManualCalendarItem(matter.id, matter.nextHearingAt);
    return matter;
  },

  createCsvImportPreview(this: SqliteStoreCore, session: ProductSession, rows: ValidatedMatterCsvRow[]): CsvImportPreview | null {
    if (session.actorType !== "staff" || !session.firmId) {
      return null;
    }
    const jobId = randomUUID();
    const previewRows = rows.map((row) => {
      const normalizedCaseNumber = row.input ? normalizeCourtCaseNumber(row.input.courtId, row.input.rawCaseNumber) : null;
      const duplicate =
        normalizedCaseNumber &&
        (this.db
          .prepare("SELECT id FROM matters WHERE firm_id = ? AND normalized_case_number = ?")
          .get(session.firmId, normalizedCaseNumber) as { id: string } | undefined);
      const error = row.error ?? (duplicate ? "Duplicate case number in workspace" : null);
      return {
        rowNumber: row.rowNumber,
        state: error ? "rejected" : "accepted",
        normalizedCaseNumber,
        error,
        payload: row.input ? { ...row.input } : {},
      };
    });
    const acceptedRows = previewRows.filter((row) => row.state === "accepted").length;
    this.db
      .prepare(`
        INSERT INTO csv_import_jobs (id, firm_id, created_by, status, total_rows, accepted_rows, rejected_rows, created_at, confirmed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)
      `)
      .run(jobId, session.firmId, session.actorId, "preview", rows.length, acceptedRows, rows.length - acceptedRows, nowIso());
    const insertRow = this.db.prepare(`
      INSERT INTO csv_import_rows (id, job_id, row_number, payload_json, normalized_case_number, state, error, matter_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
    `);
    for (const row of previewRows) {
      insertRow.run(randomUUID(), jobId, row.rowNumber, encodeJson(row.payload), row.normalizedCaseNumber, row.state, row.error);
    }
    return {
      id: jobId,
      status: "preview",
      totalRows: rows.length,
      acceptedRows,
      rejectedRows: rows.length - acceptedRows,
      rows: previewRows,
    };
  },

  getCsvImportPreview(this: SqliteStoreCore, session: ProductSession, jobId: string, rejectedOnly = false): CsvImportPreview | null {
    if (session.actorType !== "staff" || !session.firmId) {
      return null;
    }
    const job = this.db
      .prepare(`
        SELECT id, status, total_rows AS totalRows, accepted_rows AS acceptedRows, rejected_rows AS rejectedRows
        FROM csv_import_jobs WHERE id = ? AND firm_id = ?
      `)
      .get(jobId, session.firmId) as Omit<CsvImportPreview, "rows"> | undefined;
    if (!job) {
      return null;
    }
    const rows = this.db
      .prepare(`
        SELECT row_number AS rowNumber, payload_json AS payloadJson, normalized_case_number AS normalizedCaseNumber, state, error
        FROM csv_import_rows WHERE job_id = ? ${rejectedOnly ? "AND state = 'rejected'" : ""} ORDER BY row_number
      `)
      .all(jobId) as Array<{
        rowNumber: number;
        payloadJson: string;
        normalizedCaseNumber: string | null;
        state: string;
        error: string | null;
      }>;
    return { ...job, rows: rows.map((row) => ({ ...row, payload: decodeJson(row.payloadJson, {}) })) };
  },

  confirmCsvImport(this: SqliteStoreCore, session: ProductSession, jobId: string): CsvImportPreview | null {
    const preview = matterMethods.getCsvImportPreview.call(this, session, jobId);
    if (!preview || preview.status !== "preview" || !session.firmId) {
      return null;
    }
    for (const row of preview.rows.filter((entry) => entry.state === "accepted")) {
      const input = row.payload as unknown as ValidatedMatterCsvRow["input"];
      if (!input || !row.normalizedCaseNumber) {
        continue;
      }
      const matter = matterMethods.createMatter.call(this, session, {
        firmId: session.firmId,
        courtId: input.courtId,
        rawCaseNumber: input.rawCaseNumber,
        normalizedCaseNumber: row.normalizedCaseNumber,
        title: input.title,
        matterType: input.matterType,
        stage: input.stage,
        status: "open",
        nextHearingAt: input.nextHearingAt,
        leadLawyerId: session.actorId,
      });
      if (matter) {
        this.db
          .prepare("UPDATE csv_import_rows SET state = ?, matter_id = ? WHERE job_id = ? AND row_number = ?")
          .run("imported", matter.id, jobId, row.rowNumber);
      }
    }
    this.db.prepare("UPDATE csv_import_jobs SET status = ?, confirmed_at = ? WHERE id = ?").run("confirmed", nowIso(), jobId);
    return matterMethods.getCsvImportPreview.call(this, session, jobId);
  },

  updateMatter(
    this: SqliteStoreCore,
    session: ProductSession,
    matterId: string,
    patch: Partial<Omit<CreateMatterInput, "firmId">>,
  ): Matter | null {
    const existing = matterMethods.getMatter.call(this, session, matterId);
    if (!existing) {
      return null;
    }
    if (patch.leadLawyerId && !this.staffBelongsToFirm(patch.leadLawyerId, existing.firmId)) {
      return null;
    }
    const merged = {
      courtId: patch.courtId ?? existing.courtId,
      rawCaseNumber: patch.rawCaseNumber ?? existing.rawCaseNumber,
      normalizedCaseNumber: patch.normalizedCaseNumber ?? existing.normalizedCaseNumber,
      title: patch.title ?? existing.title,
      matterType: patch.matterType ?? existing.matterType,
      stage: patch.stage ?? existing.stage,
      status: patch.status ?? existing.status,
      nextHearingAt: patch.nextHearingAt === undefined ? existing.nextHearingAt : patch.nextHearingAt,
      leadLawyerId: patch.leadLawyerId === undefined ? existing.leadLawyerId : patch.leadLawyerId,
    };
    this.db
      .prepare(`
        UPDATE matters
        SET court_id = ?, raw_case_number = ?, normalized_case_number = ?, title = ?, matter_type = ?, stage = ?, status = ?, next_hearing_at = ?, lead_lawyer_id = ?, updated_at = ?
        WHERE id = ?
      `)
      .run(
        merged.courtId,
        merged.rawCaseNumber,
        merged.normalizedCaseNumber,
        merged.title,
        merged.matterType,
        merged.stage,
        merged.status,
        merged.nextHearingAt,
        merged.leadLawyerId,
        nowIso(),
        matterId,
      );

    if (patch.nextHearingAt !== undefined || patch.courtId !== undefined || patch.leadLawyerId !== undefined) {
      this.synchronizeManualCalendarItem(matterId, merged.nextHearingAt);
    }

    return this.db
      .prepare(`
        SELECT
          id,
          firm_id AS firmId,
          court_id AS courtId,
          raw_case_number AS rawCaseNumber,
          normalized_case_number AS normalizedCaseNumber,
          title,
          matter_type AS matterType,
          stage,
          status,
          next_hearing_at AS nextHearingAt,
          lead_lawyer_id AS leadLawyerId
        FROM matters
        WHERE id = ?
      `)
      .get(matterId) as unknown as Matter;
  },

  createMatterParty(
    this: SqliteStoreCore,
    session: ProductSession,
    matterId: string,
    input: Pick<MatterParty, "partyType" | "displayName" | "contactRef">,
  ): MatterParty | null {
    const firmId = this.getMatterFirmId(matterId);
    if (session.actorType !== "staff" || !firmId || !this.canAccessMatter(session, matterId, firmId) || !input.displayName.trim()) {
      return null;
    }
    const party = {
      id: randomUUID(),
      matterId,
      partyType: input.partyType,
      displayName: input.displayName.trim(),
      contactRef: input.contactRef,
    };
    this.db
      .prepare("INSERT INTO matter_parties (id, matter_id, party_type, display_name, contact_ref, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(party.id, party.matterId, party.partyType, party.displayName, party.contactRef, nowIso());
    return party;
  },

  updateMatterParty(
    this: SqliteStoreCore,
    session: ProductSession,
    matterId: string,
    partyId: string,
    patch: Partial<Pick<MatterParty, "partyType" | "displayName" | "contactRef">>,
  ): MatterParty | null {
    const matter = matterMethods.getMatter.call(this, session, matterId);
    if (!matter || session.actorType !== "staff") {
      return null;
    }
    const existing = matter.parties.find((party) => party.id === partyId);
    if (!existing) {
      return null;
    }
    const party = {
      ...existing,
      partyType: patch.partyType ?? existing.partyType,
      displayName: patch.displayName?.trim() || existing.displayName,
      contactRef: patch.contactRef === undefined ? existing.contactRef : patch.contactRef,
    };
    this.db
      .prepare("UPDATE matter_parties SET party_type = ?, display_name = ?, contact_ref = ? WHERE id = ? AND matter_id = ?")
      .run(party.partyType, party.displayName, party.contactRef, partyId, matterId);
    return party;
  },

  deleteMatterParty(this: SqliteStoreCore, session: ProductSession, matterId: string, partyId: string): boolean {
    const firmId = this.getMatterFirmId(matterId);
    if (session.actorType !== "staff" || !firmId || !this.canAccessMatter(session, matterId, firmId)) {
      return false;
    }
    const result = this.db.prepare("DELETE FROM matter_parties WHERE id = ? AND matter_id = ?").run(partyId, matterId);
    return Number(result.changes ?? 0) > 0;
  },
};
