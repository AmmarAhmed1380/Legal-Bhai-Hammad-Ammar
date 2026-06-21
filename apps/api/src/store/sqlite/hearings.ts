import { randomUUID } from "node:crypto";

import type { Hearing, ProductSession } from "@wakeel/shared";

import { nowIso } from "../utils.js";
import type { SqliteStoreCore } from "./core.js";

export const hearingMethods = {
  listHearings(this: SqliteStoreCore, session: ProductSession, matterId: string): Hearing[] {
    const firmId = this.getMatterFirmId(matterId);
    if (!firmId || !this.canAccessMatter(session, matterId, firmId)) {
      return [];
    }
    return this.db
      .prepare(`
        SELECT
          id,
          matter_id AS matterId,
          listed_at AS listedAt,
          outcome,
          notes,
          next_date AS nextDate,
          courtroom,
          bench,
          source_type AS sourceType,
          document_id AS documentId
        FROM hearings
        WHERE matter_id = ?
        ORDER BY listed_at DESC, created_at DESC
      `)
      .all(matterId) as unknown as Hearing[];
  },

  addHearing(
    this: SqliteStoreCore,
    session: ProductSession,
    input: {
      matterId: string;
      listedAt: string;
      outcome: string;
      notes: string;
      nextDate: string | null;
      courtroom: string | null;
      bench: string | null;
      sourceType: string;
      documentId: string | null;
    },
  ): Hearing | null {
    const firmId = this.getMatterFirmId(input.matterId);
    if (!firmId || !this.canAccessMatter(session, input.matterId, firmId) || session.actorType !== "staff") {
      return null;
    }
    if (input.documentId && !this.getDocument(session, input.documentId)) {
      return null;
    }

    const hearing: Hearing = {
      id: randomUUID(),
      matterId: input.matterId,
      listedAt: input.listedAt,
      outcome: input.outcome,
      notes: input.notes,
      nextDate: input.nextDate,
      courtroom: input.courtroom,
      bench: input.bench,
      sourceType: input.sourceType,
      documentId: input.documentId,
    };

    this.db
      .prepare(`
        INSERT INTO hearings (id, matter_id, listed_at, outcome, notes, next_date, courtroom, bench, source_type, document_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        hearing.id,
        hearing.matterId,
        hearing.listedAt,
        hearing.outcome,
        hearing.notes,
        hearing.nextDate,
        hearing.courtroom,
        hearing.bench,
        hearing.sourceType,
        hearing.documentId,
        nowIso(),
      );

    if (hearing.nextDate) {
      this.db.prepare("UPDATE matters SET next_hearing_at = ?, updated_at = ? WHERE id = ?").run(hearing.nextDate, nowIso(), hearing.matterId);
      this.synchronizeManualCalendarItem(hearing.matterId, hearing.nextDate);
    }

    this.createAuditEvent({
      firmId,
      actorType: "system",
      actorId: null,
      objectType: "hearing",
      objectId: hearing.id,
      eventType: "hearing.created",
      payload: { matterId: hearing.matterId, sourceType: hearing.sourceType },
    });
    this.enqueueMatterClientUpdate(firmId, hearing);

    return hearing;
  },
};
