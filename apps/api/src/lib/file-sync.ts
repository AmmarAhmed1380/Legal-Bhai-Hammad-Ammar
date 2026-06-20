import { writeFileSync, mkdirSync, readdirSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";

export function syncToFiles(db: DatabaseSync): void {
  const dir = join(process.cwd(), "data", "store-files");
  try {
    mkdirSync(dir, { recursive: true });
  } catch {}

  const activeLawyerIds = new Set<string>();
  const activeClientIds = new Set<string>();

  // Helper to parse JSON safely
  const parseJson = (str: string | null): any => {
    if (!str) return [];
    try {
      return JSON.parse(str);
    } catch {
      return [];
    }
  };

  // 1. Update workspaces.json
  const firms = db.prepare("SELECT id, name, primary_city AS primaryCity, billing_plan AS billingPlan, timezone, status, created_at AS createdAt FROM firms").all() as any[];
  const workspaces: any[] = [];

  for (const firm of firms) {
    const ownerRow = db.prepare(`
      SELECT u.id, u.phone, u.display_name AS displayName, u.email, u.status
      FROM product_users u
      JOIN firm_memberships fm ON fm.user_id = u.id
      WHERE fm.firm_id = ? AND fm.role = 'owner'
    `).get(firm.id) as any;

    const employees = db.prepare(`
      SELECT u.id, u.phone, u.display_name AS displayName, u.email, fm.role, fm.office_label AS officeLabel, u.status
      FROM product_users u
      JOIN firm_memberships fm ON fm.user_id = u.id
      WHERE fm.firm_id = ?
    `).all(firm.id) as any[];

    workspaces.push({
      workspaceId: firm.id,
      name: firm.name,
      primaryCity: firm.primaryCity,
      billingPlan: firm.billingPlan,
      timezone: firm.timezone,
      status: firm.status,
      createdAt: firm.createdAt,
      owner: ownerRow || null,
      employees: employees || []
    });
  }
  writeFileSync(join(dir, "workspaces.json"), JSON.stringify(workspaces, null, 2), "utf8");

  // 2. Update lawyer_${lawyerId}.json files
  const lawyers = db.prepare("SELECT id, phone, display_name AS displayName, email, language, status, created_at AS createdAt FROM product_users").all() as any[];
  
  for (const lawyer of lawyers) {
    activeLawyerIds.add(lawyer.id);

    const membership = db.prepare("SELECT firm_id AS firmId, role, office_label AS officeLabel, permissions_json AS permissionsJson FROM firm_memberships WHERE user_id = ?").get(lawyer.id) as any;
    if (!membership) continue;

    const firm = db.prepare("SELECT id, name, primary_city AS primaryCity, billing_plan AS billingPlan FROM firms WHERE id = ?").get(membership.firmId) as any;

    // Matters
    const matters = db.prepare("SELECT id, court_id AS courtId, raw_case_number AS rawCaseNumber, normalized_case_number AS normalizedCaseNumber, title, matter_type AS matterType, stage, status, next_hearing_at AS nextHearingAt, lead_lawyer_id AS leadLawyerId, created_at AS createdAt FROM matters WHERE firm_id = ?").all(membership.firmId) as any[];
    const mattersWithDetails: any[] = [];
    
    for (const m of matters) {
      const parties = db.prepare("SELECT id, party_type AS partyType, display_name AS displayName, contact_ref AS contactRef FROM matter_parties WHERE matter_id = ?").all(m.id) as any[];
      const hearings = db.prepare("SELECT id, listed_at AS listedAt, outcome, notes, next_date AS nextDate, courtroom, bench, source_type AS sourceType FROM hearings WHERE matter_id = ?").all(m.id) as any[];
      const documents = db.prepare("SELECT id, title, type, mime_type AS mimeType, storage_key AS storageKey, ocr_status AS ocrStatus, portal_visible AS portalVisible FROM documents WHERE matter_id = ?").all(m.id) as any[];

      mattersWithDetails.push({
        ...m,
        parties: parties || [],
        hearings: hearings || [],
        documents: documents || []
      });
    }

    // Alerts
    const alerts = db.prepare("SELECT id, type, title, body, created_at AS createdAt, read_at AS readAt FROM alerts WHERE firm_id = ?").all(membership.firmId) as any[];

    // Settings
    const settings = {
      role: membership.role,
      permissions: parseJson(membership.permissionsJson),
      officeLabel: membership.officeLabel
    };

    // Personal Documents
    const personalDocuments = db.prepare("SELECT id, title, type, mime_type AS mimeType, storage_key AS storageKey, ocr_status AS ocrStatus, portal_visible AS portalVisible FROM documents WHERE firm_id = ? AND matter_id IS NULL").all(membership.firmId) as any[];

    // Clients
    const clients = db.prepare("SELECT id, phone, display_name AS displayName, language, status, created_at AS createdAt FROM client_accounts WHERE firm_id = ?").all(membership.firmId) as any[];
    const clientsWithNotes = clients.map((c: any) => ({
      ...c,
      notes: [] // placeholder list for notes
    }));

    const lawyerData = {
      lawyerId: lawyer.id,
      phone: lawyer.phone,
      displayName: lawyer.displayName,
      email: lawyer.email,
      language: lawyer.language,
      status: lawyer.status,
      createdAt: lawyer.createdAt,
      firm: firm || null,
      settings,
      matters: mattersWithDetails,
      alerts: alerts || [],
      personalDocuments: personalDocuments || [],
      clients: clientsWithNotes
    };

    writeFileSync(join(dir, `lawyer_${lawyer.id}.json`), JSON.stringify(lawyerData, null, 2), "utf8");
  }

  // 3. Update client_${clientId}.json files
  const clients = db.prepare("SELECT id, phone, display_name AS displayName, language, status, created_at AS createdAt, firm_id AS firmId FROM client_accounts").all() as any[];

  for (const client of clients) {
    activeClientIds.add(client.id);

    const clientMemberships = db.prepare("SELECT matter_id AS matterId FROM client_memberships WHERE client_account_id = ?").all(client.id) as any[];
    const sharedMatters: any[] = [];
    const messages: any[] = [];

    for (const cm of clientMemberships) {
      const m = db.prepare("SELECT id, court_id AS courtId, raw_case_number AS rawCaseNumber, normalized_case_number AS normalizedCaseNumber, title, stage, status, next_hearing_at AS nextHearingAt FROM matters WHERE id = ?").get(cm.matterId) as any;
      if (!m) continue;

      const hearings = db.prepare("SELECT id, listed_at AS listedAt, outcome, notes, next_date AS nextDate, courtroom FROM hearings WHERE matter_id = ?").all(m.id) as any[];
      const documents = db.prepare("SELECT id, title, type, mime_type AS mimeType, ocr_status AS ocrStatus FROM documents WHERE matter_id = ? AND portal_visible = 1").all(m.id) as any[];

      sharedMatters.push({
        ...m,
        hearings: hearings || [],
        documents: documents || []
      });

      const thread = db.prepare("SELECT id FROM message_threads WHERE matter_id = ?").get(cm.matterId) as any;
      if (thread) {
        const threadMessages = db.prepare("SELECT id, sender_type AS senderType, body, language, delivery_channel AS deliveryChannel, created_at AS createdAt FROM messages WHERE thread_id = ?").all(thread.id) as any[];
        messages.push(...(threadMessages || []));
      }
    }

    const clientData = {
      clientId: client.id,
      phone: client.phone,
      displayName: client.displayName,
      language: client.language,
      status: client.status,
      createdAt: client.createdAt,
      firmId: client.firmId,
      sharedMatters,
      messages: messages.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    };

    writeFileSync(join(dir, `client_${client.id}.json`), JSON.stringify(clientData, null, 2), "utf8");
  }

  // 4. Delete files for deleted lawyers or clients
  if (existsSync(dir)) {
    const files = readdirSync(dir);
    for (const file of files) {
      if (file.startsWith("lawyer_") && file.endsWith(".json")) {
        const id = file.slice("lawyer_".length, -".json".length);
        if (!activeLawyerIds.has(id)) {
          try {
            unlinkSync(join(dir, file));
          } catch {}
        }
      } else if (file.startsWith("client_") && file.endsWith(".json")) {
        const id = file.slice("client_".length, -".json".length);
        if (!activeClientIds.has(id)) {
          try {
            unlinkSync(join(dir, file));
          } catch {}
        }
      }
    }
  }
}
