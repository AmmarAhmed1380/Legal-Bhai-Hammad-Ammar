BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS "alerts" (
	"id"	TEXT,
	"firm_id"	TEXT NOT NULL,
	"type"	TEXT NOT NULL,
	"title"	TEXT NOT NULL,
	"body"	TEXT NOT NULL,
	"created_at"	TEXT NOT NULL,
	"read_at"	TEXT,
	PRIMARY KEY("id"),
	FOREIGN KEY("firm_id") REFERENCES "firms"("id") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "app_sessions" (
	"id"	TEXT,
	"actor_type"	TEXT NOT NULL,
	"actor_id"	TEXT NOT NULL,
	"firm_id"	TEXT,
	"auth_method"	TEXT NOT NULL,
	"created_at"	TEXT NOT NULL,
	"revoked_at"	TEXT,
	PRIMARY KEY("id")
);
CREATE TABLE IF NOT EXISTS "audit_events" (
	"id"	TEXT,
	"firm_id"	TEXT NOT NULL,
	"actor_type"	TEXT NOT NULL,
	"actor_id"	TEXT,
	"object_type"	TEXT NOT NULL,
	"object_id"	TEXT NOT NULL,
	"event_type"	TEXT NOT NULL,
	"payload_json"	TEXT NOT NULL,
	"created_at"	TEXT NOT NULL,
	PRIMARY KEY("id"),
	FOREIGN KEY("firm_id") REFERENCES "firms"("id") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "calendar_items" (
	"id"	TEXT,
	"matter_id"	TEXT NOT NULL,
	"listed_at"	TEXT NOT NULL,
	"courtroom"	TEXT,
	"bench"	TEXT,
	"source_type"	TEXT NOT NULL,
	"source_confidence"	REAL NOT NULL,
	"conflict_state"	TEXT NOT NULL,
	"created_at"	TEXT NOT NULL,
	PRIMARY KEY("id"),
	FOREIGN KEY("matter_id") REFERENCES "matters"("id") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "cause_list_entries" (
	"id"	TEXT,
	"court_source_id"	TEXT NOT NULL,
	"court_id"	TEXT,
	"list_date"	TEXT NOT NULL,
	"list_type"	TEXT NOT NULL,
	"normalized_case_number"	TEXT NOT NULL,
	"raw_case_number"	TEXT NOT NULL,
	"courtroom"	TEXT,
	"bench"	TEXT,
	"source_hash"	TEXT NOT NULL UNIQUE,
	"created_at"	TEXT NOT NULL,
	PRIMARY KEY("id"),
	FOREIGN KEY("court_source_id") REFERENCES "court_sources"("id") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "client_accounts" (
	"id"	TEXT,
	"phone"	TEXT NOT NULL,
	"display_name"	TEXT NOT NULL,
	"language"	TEXT NOT NULL,
	"status"	TEXT NOT NULL,
	"created_at"	TEXT NOT NULL,
	"firm_id"	TEXT,
	UNIQUE("firm_id","phone"),
	PRIMARY KEY("id")
);
CREATE TABLE IF NOT EXISTS "client_memberships" (
	"id"	TEXT,
	"client_account_id"	TEXT NOT NULL,
	"matter_id"	TEXT NOT NULL,
	"access_level"	TEXT NOT NULL,
	"created_at"	TEXT NOT NULL,
	PRIMARY KEY("id"),
	FOREIGN KEY("client_account_id") REFERENCES "client_accounts"("id") ON DELETE CASCADE,
	FOREIGN KEY("matter_id") REFERENCES "matters"("id") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "court_sources" (
	"id"	TEXT,
	"court_id"	TEXT NOT NULL UNIQUE,
	"source_type"	TEXT NOT NULL,
	"ingestion_mode"	TEXT NOT NULL,
	"status"	TEXT NOT NULL,
	"last_successful_sync_at"	TEXT,
	"metrics_json"	TEXT NOT NULL,
	"created_at"	TEXT NOT NULL,
	PRIMARY KEY("id")
);
CREATE TABLE IF NOT EXISTS "csv_import_jobs" (
	"id"	TEXT,
	"firm_id"	TEXT NOT NULL,
	"created_by"	TEXT NOT NULL,
	"status"	TEXT NOT NULL,
	"total_rows"	INTEGER NOT NULL,
	"accepted_rows"	INTEGER NOT NULL,
	"rejected_rows"	INTEGER NOT NULL,
	"created_at"	TEXT NOT NULL,
	"confirmed_at"	TEXT,
	PRIMARY KEY("id"),
	FOREIGN KEY("firm_id") REFERENCES "firms"("id") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "csv_import_rows" (
	"id"	TEXT,
	"job_id"	TEXT NOT NULL,
	"row_number"	INTEGER NOT NULL,
	"payload_json"	TEXT NOT NULL,
	"normalized_case_number"	TEXT,
	"state"	TEXT NOT NULL,
	"error"	TEXT,
	"matter_id"	TEXT,
	PRIMARY KEY("id"),
	FOREIGN KEY("job_id") REFERENCES "csv_import_jobs"("id") ON DELETE CASCADE,
	FOREIGN KEY("matter_id") REFERENCES "matters"("id") ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS "document_links" (
	"id"	TEXT,
	"document_id"	TEXT NOT NULL,
	"matter_id"	TEXT NOT NULL,
	"created_at"	TEXT NOT NULL,
	PRIMARY KEY("id"),
	FOREIGN KEY("document_id") REFERENCES "documents"("id") ON DELETE CASCADE,
	FOREIGN KEY("matter_id") REFERENCES "matters"("id") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "documents" (
	"id"	TEXT,
	"firm_id"	TEXT NOT NULL,
	"matter_id"	TEXT,
	"folder_id"	TEXT,
	"type"	TEXT NOT NULL,
	"title"	TEXT NOT NULL,
	"storage_key"	TEXT NOT NULL,
	"mime_type"	TEXT NOT NULL,
	"uploaded_by"	TEXT NOT NULL,
	"ocr_status"	TEXT NOT NULL,
	"ocr_text"	TEXT,
	"search_text"	TEXT,
	"portal_visible"	INTEGER NOT NULL DEFAULT 0,
	"created_at"	TEXT NOT NULL,
	PRIMARY KEY("id"),
	FOREIGN KEY("firm_id") REFERENCES "firms"("id") ON DELETE CASCADE,
	FOREIGN KEY("matter_id") REFERENCES "matters"("id") ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS "firm_memberships" (
	"id"	TEXT,
	"firm_id"	TEXT NOT NULL,
	"user_id"	TEXT NOT NULL,
	"role"	TEXT NOT NULL,
	"permissions_json"	TEXT NOT NULL,
	"office_label"	TEXT,
	"created_at"	TEXT NOT NULL,
	PRIMARY KEY("id"),
	FOREIGN KEY("firm_id") REFERENCES "firms"("id") ON DELETE CASCADE,
	FOREIGN KEY("user_id") REFERENCES "product_users"("id") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "firms" (
	"id"	TEXT,
	"name"	TEXT NOT NULL,
	"primary_city"	TEXT NOT NULL,
	"billing_plan"	TEXT NOT NULL,
	"timezone"	TEXT NOT NULL,
	"status"	TEXT NOT NULL,
	"created_at"	TEXT NOT NULL,
	PRIMARY KEY("id")
);
CREATE TABLE IF NOT EXISTS "hearings" (
	"id"	TEXT,
	"matter_id"	TEXT NOT NULL,
	"listed_at"	TEXT NOT NULL,
	"outcome"	TEXT NOT NULL,
	"notes"	TEXT NOT NULL,
	"next_date"	TEXT,
	"courtroom"	TEXT,
	"bench"	TEXT,
	"source_type"	TEXT NOT NULL,
	"document_id"	TEXT,
	"created_at"	TEXT NOT NULL,
	PRIMARY KEY("id"),
	FOREIGN KEY("document_id") REFERENCES "documents"("id") ON DELETE SET NULL,
	FOREIGN KEY("matter_id") REFERENCES "matters"("id") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "ingestion_runs" (
	"id"	TEXT,
	"court_source_id"	TEXT NOT NULL,
	"court_id"	TEXT NOT NULL,
	"status"	TEXT NOT NULL,
	"rows_fetched"	INTEGER NOT NULL,
	"rows_parsed"	INTEGER NOT NULL,
	"rows_matched"	INTEGER NOT NULL,
	"parser_failures"	INTEGER NOT NULL,
	"unmatched_count"	INTEGER NOT NULL,
	"note"	TEXT,
	"started_at"	TEXT NOT NULL,
	"finished_at"	TEXT NOT NULL,
	"created_at"	TEXT NOT NULL,
	PRIMARY KEY("id"),
	FOREIGN KEY("court_source_id") REFERENCES "court_sources"("id") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "invoices" (
	"id"	TEXT,
	"firm_id"	TEXT NOT NULL,
	"client_account_id"	TEXT NOT NULL,
	"matter_id"	TEXT,
	"status"	TEXT NOT NULL,
	"issued_at"	TEXT,
	"due_at"	TEXT,
	"total"	INTEGER NOT NULL,
	"created_at"	TEXT NOT NULL,
	PRIMARY KEY("id"),
	FOREIGN KEY("client_account_id") REFERENCES "client_accounts"("id") ON DELETE CASCADE,
	FOREIGN KEY("firm_id") REFERENCES "firms"("id") ON DELETE CASCADE,
	FOREIGN KEY("matter_id") REFERENCES "matters"("id") ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS "magic_link_tokens" (
	"id"	TEXT,
	"user_id"	TEXT NOT NULL,
	"token_hash"	TEXT NOT NULL UNIQUE,
	"expires_at"	TEXT NOT NULL,
	"used_at"	TEXT,
	"created_at"	TEXT NOT NULL,
	PRIMARY KEY("id"),
	FOREIGN KEY("user_id") REFERENCES "product_users"("id") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "matter_matches" (
	"id"	TEXT,
	"firm_id"	TEXT NOT NULL,
	"matter_id"	TEXT NOT NULL,
	"cause_list_entry_id"	TEXT NOT NULL,
	"confidence"	REAL NOT NULL,
	"state"	TEXT NOT NULL,
	"reviewed_by"	TEXT,
	"reviewed_at"	TEXT,
	"created_at"	TEXT NOT NULL,
	PRIMARY KEY("id"),
	UNIQUE("matter_id","cause_list_entry_id"),
	FOREIGN KEY("cause_list_entry_id") REFERENCES "cause_list_entries"("id") ON DELETE CASCADE,
	FOREIGN KEY("firm_id") REFERENCES "firms"("id") ON DELETE CASCADE,
	FOREIGN KEY("matter_id") REFERENCES "matters"("id") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "matter_parties" (
	"id"	TEXT,
	"matter_id"	TEXT NOT NULL,
	"party_type"	TEXT NOT NULL,
	"display_name"	TEXT NOT NULL,
	"contact_ref"	TEXT,
	"created_at"	TEXT NOT NULL,
	PRIMARY KEY("id"),
	FOREIGN KEY("matter_id") REFERENCES "matters"("id") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "matters" (
	"id"	TEXT,
	"firm_id"	TEXT NOT NULL,
	"court_id"	TEXT NOT NULL,
	"raw_case_number"	TEXT NOT NULL,
	"normalized_case_number"	TEXT NOT NULL,
	"title"	TEXT NOT NULL,
	"matter_type"	TEXT NOT NULL,
	"stage"	TEXT NOT NULL,
	"status"	TEXT NOT NULL,
	"next_hearing_at"	TEXT,
	"lead_lawyer_id"	TEXT,
	"created_at"	TEXT NOT NULL,
	"updated_at"	TEXT NOT NULL,
	PRIMARY KEY("id"),
	FOREIGN KEY("firm_id") REFERENCES "firms"("id") ON DELETE CASCADE,
	FOREIGN KEY("lead_lawyer_id") REFERENCES "product_users"("id")
);
CREATE TABLE IF NOT EXISTS "message_threads" (
	"id"	TEXT,
	"matter_id"	TEXT NOT NULL UNIQUE,
	"participant_type"	TEXT NOT NULL,
	"status"	TEXT NOT NULL,
	"created_at"	TEXT NOT NULL,
	PRIMARY KEY("id"),
	FOREIGN KEY("matter_id") REFERENCES "matters"("id") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "messages" (
	"id"	TEXT,
	"thread_id"	TEXT NOT NULL,
	"sender_type"	TEXT NOT NULL,
	"sender_id"	TEXT NOT NULL,
	"body"	TEXT NOT NULL,
	"language"	TEXT NOT NULL,
	"delivery_channel"	TEXT NOT NULL,
	"delivery_state"	TEXT NOT NULL,
	"created_at"	TEXT NOT NULL,
	PRIMARY KEY("id"),
	FOREIGN KEY("thread_id") REFERENCES "message_threads"("id") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "notification_attempts" (
	"id"	TEXT,
	"job_id"	TEXT NOT NULL,
	"provider_id"	TEXT,
	"status"	TEXT NOT NULL,
	"error"	TEXT,
	"attempted_at"	TEXT NOT NULL,
	PRIMARY KEY("id"),
	FOREIGN KEY("job_id") REFERENCES "notification_jobs"("id") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "notification_consents" (
	"id"	TEXT,
	"firm_id"	TEXT NOT NULL,
	"actor_type"	TEXT NOT NULL,
	"actor_id"	TEXT NOT NULL,
	"channel"	TEXT NOT NULL,
	"status"	TEXT NOT NULL,
	"source"	TEXT NOT NULL,
	"granted_at"	TEXT,
	"revoked_at"	TEXT,
	"updated_at"	TEXT NOT NULL,
	UNIQUE("firm_id","actor_type","actor_id","channel"),
	PRIMARY KEY("id"),
	FOREIGN KEY("firm_id") REFERENCES "firms"("id") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "notification_jobs" (
	"id"	TEXT,
	"firm_id"	TEXT NOT NULL,
	"actor_type"	TEXT NOT NULL,
	"actor_id"	TEXT NOT NULL,
	"channel"	TEXT NOT NULL,
	"template_key"	TEXT NOT NULL,
	"template_version"	INTEGER NOT NULL DEFAULT 1,
	"payload_json"	TEXT NOT NULL,
	"idempotency_key"	TEXT NOT NULL UNIQUE,
	"scheduled_at"	TEXT NOT NULL,
	"status"	TEXT NOT NULL,
	"attempt_count"	INTEGER NOT NULL DEFAULT 0,
	"last_error"	TEXT,
	"created_at"	TEXT NOT NULL,
	PRIMARY KEY("id"),
	FOREIGN KEY("firm_id") REFERENCES "firms"("id") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "notification_preferences" (
	"id"	TEXT,
	"firm_id"	TEXT NOT NULL,
	"actor_type"	TEXT NOT NULL,
	"actor_id"	TEXT NOT NULL,
	"email_enabled"	INTEGER NOT NULL,
	"sms_enabled"	INTEGER NOT NULL,
	"opted_out_at"	TEXT,
	"updated_at"	TEXT NOT NULL,
	UNIQUE("firm_id","actor_type","actor_id"),
	PRIMARY KEY("id"),
	FOREIGN KEY("firm_id") REFERENCES "firms"("id") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "notification_templates" (
	"template_key"	TEXT NOT NULL,
	"channel"	TEXT NOT NULL,
	"version"	INTEGER NOT NULL,
	"subject_template"	TEXT NOT NULL,
	"body_template"	TEXT NOT NULL,
	"enabled"	INTEGER NOT NULL DEFAULT 1,
	"created_at"	TEXT NOT NULL,
	PRIMARY KEY("template_key","channel","version")
);
CREATE TABLE IF NOT EXISTS "otp_requests" (
	"id"	TEXT,
	"actor_type"	TEXT NOT NULL,
	"phone"	TEXT NOT NULL,
	"code_hash"	TEXT NOT NULL,
	"expires_at"	TEXT NOT NULL,
	"used_at"	TEXT,
	"created_at"	TEXT NOT NULL,
	"attempt_count"	INTEGER NOT NULL DEFAULT 0,
	PRIMARY KEY("id")
);
CREATE TABLE IF NOT EXISTS "pilot_invites" (
	"id"	TEXT,
	"phone"	TEXT NOT NULL UNIQUE,
	"email"	TEXT,
	"status"	TEXT NOT NULL,
	"invited_at"	TEXT NOT NULL,
	"accepted_at"	TEXT,
	PRIMARY KEY("id")
);
CREATE TABLE IF NOT EXISTS "portal_links" (
	"id"	TEXT,
	"matter_id"	TEXT NOT NULL,
	"client_account_id"	TEXT NOT NULL,
	"created_by"	TEXT NOT NULL,
	"token_hash"	TEXT NOT NULL UNIQUE,
	"expires_at"	TEXT NOT NULL,
	"created_at"	TEXT NOT NULL,
	"revoked_at"	TEXT,
	PRIMARY KEY("id"),
	FOREIGN KEY("client_account_id") REFERENCES "client_accounts"("id") ON DELETE CASCADE,
	FOREIGN KEY("created_by") REFERENCES "product_users"("id") ON DELETE CASCADE,
	FOREIGN KEY("matter_id") REFERENCES "matters"("id") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "product_users" (
	"id"	TEXT,
	"phone"	TEXT NOT NULL UNIQUE,
	"email"	TEXT UNIQUE,
	"display_name"	TEXT NOT NULL,
	"language"	TEXT NOT NULL,
	"status"	TEXT NOT NULL,
	"created_at"	TEXT NOT NULL,
	PRIMARY KEY("id")
);
CREATE TABLE IF NOT EXISTS "refresh_tokens" (
	"id"	TEXT,
	"session_id"	TEXT NOT NULL,
	"token_hash"	TEXT NOT NULL UNIQUE,
	"expires_at"	TEXT NOT NULL,
	"created_at"	TEXT NOT NULL,
	"revoked_at"	TEXT,
	PRIMARY KEY("id"),
	FOREIGN KEY("session_id") REFERENCES "app_sessions"("id") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "time_entries" (
	"id"	TEXT,
	"firm_id"	TEXT NOT NULL,
	"matter_id"	TEXT NOT NULL,
	"user_id"	TEXT NOT NULL,
	"started_at"	TEXT NOT NULL,
	"minutes"	INTEGER NOT NULL,
	"narrative"	TEXT NOT NULL,
	"billable"	INTEGER NOT NULL,
	"created_at"	TEXT NOT NULL,
	PRIMARY KEY("id"),
	FOREIGN KEY("firm_id") REFERENCES "firms"("id") ON DELETE CASCADE,
	FOREIGN KEY("matter_id") REFERENCES "matters"("id") ON DELETE CASCADE,
	FOREIGN KEY("user_id") REFERENCES "product_users"("id") ON DELETE CASCADE
);
INSERT INTO "alerts" VALUES ('alert-redtone','firm-hassan-co','hearing_due','Order pronouncement approaching','W.P. 2076/2019 is fixed for order pronouncement at IHC.','2026-06-22T05:46:48.002Z',NULL);
INSERT INTO "alerts" VALUES ('alert-message','firm-hassan-co','client_message','New client reply from Ahmed Zubair','Client confirmed witness documents for the property suit.','2026-06-22T05:46:48.002Z',NULL);
INSERT INTO "audit_events" VALUES ('b17853e3-0623-48eb-95a4-4bdc41090c85','firm-hassan-co','system',NULL,'firm','firm-hassan-co','seeded','{"matters":2,"clients":1}','2026-06-22T05:46:48.683Z');
INSERT INTO "calendar_items" VALUES ('calendar-redtone','matter-redtone','2026-08-18T11:00:00+05:00','Court No: 8','Bench A','live_ihc',0.96,'none','2026-06-22T05:46:48.002Z');
INSERT INTO "calendar_items" VALUES ('calendar-zubair-property','matter-farooq','2026-08-24T14:00:00+05:00','Civil Court Room 6','Civil Judge Rawalpindi','live_rwp_district',0.9,'none','2026-06-22T05:46:48.002Z');
INSERT INTO "client_accounts" VALUES ('client-redtone','03005550001','Ahmed Zubair','en','active','2026-06-22T05:46:48.002Z','firm-hassan-co');
INSERT INTO "client_memberships" VALUES ('client-membership-redtone','client-redtone','matter-redtone','message','2026-06-22T05:46:48.002Z');
INSERT INTO "client_memberships" VALUES ('client-membership-zubair-property','client-redtone','matter-farooq','message','2026-06-22T05:46:48.002Z');
INSERT INTO "court_sources" VALUES ('source-ihc','ihc','high_court','automation','live','2026-04-21T04:12:00Z','{"fetched":220,"matched":14,"parserErrors":0}','2026-06-22T05:46:48.002Z');
INSERT INTO "court_sources" VALUES ('source-lhc-rwp','lhc-rawalpindi-bench','high_court','automation','live','2026-06-22T03:46:48.002Z','{"fetched":0,"matched":0,"parserErrors":0}','2026-06-22T05:46:48.002Z');
INSERT INTO "court_sources" VALUES ('source-rwp-district','rwp-district-sessions','district','automation','live','2026-05-18T03:25:00Z','{"fetched":74,"matched":5,"parserErrors":0}','2026-06-22T05:46:48.002Z');
INSERT INTO "document_links" VALUES ('document-link-doc-redtone-vakalatnama','doc-redtone-vakalatnama','matter-redtone','2026-06-22T05:46:48.002Z');
INSERT INTO "document_links" VALUES ('document-link-doc-redtone-written-objections','doc-redtone-written-objections','matter-redtone','2026-06-22T05:46:48.002Z');
INSERT INTO "document_links" VALUES ('document-link-doc-redtone-order','doc-redtone-order','matter-redtone','2026-06-22T05:46:48.002Z');
INSERT INTO "document_links" VALUES ('document-link-doc-redtone-hearing-order','doc-redtone-hearing-order','matter-redtone','2026-06-22T05:46:48.002Z');
INSERT INTO "document_links" VALUES ('document-link-doc-farooq-pleading','doc-farooq-pleading','matter-farooq','2026-06-22T05:46:48.002Z');
INSERT INTO "documents" VALUES ('doc-redtone-vakalatnama','firm-hassan-co','matter-redtone',NULL,'Agreement / Contract','Vakalatnama_Signed.pdf','seed:vakalatnama-signed.pdf','application/pdf','staff-owner','completed','Signed vakalatnama authorizing Advocate Salman Hassan to appear before Islamabad High Court.','Signed vakalatnama Redtone Telecommunications Advocate Salman Hassan Islamabad High Court.',1,'2026-06-22T05:46:48.157Z');
INSERT INTO "documents" VALUES ('doc-redtone-written-objections','firm-hassan-co','matter-redtone',NULL,'General','Written_Objections_Final.docx','seed:written-objections-final.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document','staff-owner','completed','Final written objections with jurisdictional grounds, facts, legal arguments, and prayer clauses.','Final written objections jurisdictional grounds Redtone Telecommunications tax recovery Islamabad High Court.',1,'2026-06-22T05:46:48.168Z');
INSERT INTO "documents" VALUES ('doc-redtone-order','firm-hassan-co','matter-redtone',NULL,'Evidence','Evidence_Annexures.pdf','seed:evidence-annexures.pdf','application/pdf','staff-owner','completed','Evidence annexures with payment receipts, department correspondence, and tax recovery notices.','Evidence annexures payment receipts correspondence tax recovery notices Redtone.',1,'2026-06-22T05:46:48.179Z');
INSERT INTO "documents" VALUES ('doc-redtone-hearing-order','firm-hassan-co','matter-redtone',NULL,'Court Notice','Hearing_Order_April.png','seed:hearing-order-april.png','image/png','staff-owner','completed','Islamabad High Court order sheet showing arguments heard and order reserved for pronouncement.','Islamabad High Court order sheet arguments heard order reserved pronouncement.',1,'2026-06-22T05:46:48.190Z');
INSERT INTO "documents" VALUES ('doc-farooq-pleading','firm-hassan-co','matter-farooq',NULL,'General','Plaint_Property_Dispute.pdf','seed:plaint-property-dispute.pdf','application/pdf','staff-owner','completed','Plaint seeking declaration, specific performance, and damages against Property Builders Ltd.','Plaint Ahmed Zubair Property Builders Ltd declaration specific performance damages.',1,'2026-06-22T05:46:48.200Z');
INSERT INTO "firm_memberships" VALUES ('membership-owner','firm-hassan-co','staff-owner','owner','["*"]','Islamabad HQ','2026-06-22T05:46:48.002Z');
INSERT INTO "firm_memberships" VALUES ('membership-lawyer','firm-hassan-co','staff-lawyer','lawyer','["matters.read","matters.write","hearings.write","documents.read","documents.write","time.write","court.sync"]','Islamabad HQ','2026-06-22T05:46:48.002Z');
INSERT INTO "firm_memberships" VALUES ('membership-assistant','firm-hassan-co','staff-assistant','assistant','["matters.read","documents.read"]','Rawalpindi Desk','2026-06-22T05:46:48.002Z');
INSERT INTO "firms" VALUES ('firm-hassan-co','Hassan & Co. Law Associates','Islamabad','solo_plus','Asia/Karachi','trial','2026-06-22T05:46:48.002Z');
INSERT INTO "hearings" VALUES ('hearing-redtone-1','matter-redtone','2026-08-18T11:00:00+05:00','Order pronouncement fixed','Bench heard both sides and fixed the matter for order pronouncement.','2026-08-18','Court No: 8','Justice Muhammad Azam Khan / Justice Inaam Ameen Minhas','live_ihc',NULL,'2026-06-22T05:46:48.002Z');
INSERT INTO "hearings" VALUES ('hearing-zubair-property-1','matter-farooq','2026-08-24T14:00:00+05:00','Evidence fixed','Plaintiff witnesses to appear with original allotment documents and payment receipts.','2026-08-24','Civil Court Room 6','Civil Judge Rawalpindi','live_rwp_district',NULL,'2026-06-22T05:46:48.002Z');
INSERT INTO "ingestion_runs" VALUES ('run-ihc-latest','source-ihc','ihc','completed',220,220,14,0,3,NULL,'2026-04-21T04:10:00Z','2026-04-21T04:12:00Z','2026-06-22T05:46:48.002Z');
INSERT INTO "ingestion_runs" VALUES ('run-lhc-rwp-latest','source-lhc-rwp','lhc-rawalpindi-bench','needs_review',0,0,0,0,0,NULL,'2026-04-21T03:45:00Z','2026-04-21T03:48:00Z','2026-06-22T05:46:48.002Z');
INSERT INTO "ingestion_runs" VALUES ('run-rwp-latest','source-rwp-district','rwp-district-sessions','needs_review',74,72,5,2,6,NULL,'2026-05-18T03:22:00Z','2026-05-18T03:25:00Z','2026-06-22T05:46:48.002Z');
INSERT INTO "invoices" VALUES ('invoice-redtone','firm-hassan-co','client-redtone','matter-redtone','issued','2026-05-15','2026-05-30',85000,'2026-06-22T05:46:48.002Z');
INSERT INTO "matter_parties" VALUES ('party-redtone-a','matter-redtone','petitioner','Redtone Telecommunications Pak Pvt Ltd','client-redtone','2026-06-22T05:46:48.002Z');
INSERT INTO "matter_parties" VALUES ('party-redtone-b','matter-redtone','respondent','Commissioner Inland Revenue',NULL,'2026-06-22T05:46:48.002Z');
INSERT INTO "matter_parties" VALUES ('party-zubair-property-a','matter-farooq','plaintiff','Ahmed Zubair','client-redtone','2026-06-22T05:46:48.002Z');
INSERT INTO "matter_parties" VALUES ('party-zubair-property-b','matter-farooq','defendant','Property Builders Ltd',NULL,'2026-06-22T05:46:48.002Z');
INSERT INTO "matters" VALUES ('matter-redtone','firm-hassan-co','ihc','W.P. 2076/2019','WRIT PETITION 2076/2019','Redtone Telecommunications Pak Pvt Ltd v CIR etc','litigation','arguments','open','2026-08-18T11:00:00+05:00','staff-owner','2026-06-22T05:46:48.002Z','2026-06-22T05:46:48.002Z');
INSERT INTO "matters" VALUES ('matter-farooq','firm-hassan-co','rwp-district-sessions','Civil Suit 45/2025','CIVIL SUIT 45/2025','Ahmed Zubair v. Property Builders Ltd','litigation','evidence','open','2026-08-24T14:00:00+05:00','staff-owner','2026-06-22T05:46:48.002Z','2026-06-22T05:46:48.002Z');
INSERT INTO "message_threads" VALUES ('thread-redtone','matter-redtone','firm_client','open','2026-06-22T05:46:48.002Z');
INSERT INTO "message_threads" VALUES ('thread-zubair-property','matter-farooq','firm_client','open','2026-06-22T05:46:48.002Z');
INSERT INTO "messages" VALUES ('message-redtone-1','thread-redtone','staff','staff-owner','Arguments concluded today before the Islamabad High Court. The bench has fixed the matter for order pronouncement.','en','in_app','delivered','2026-05-14T11:42:00+05:00');
INSERT INTO "messages" VALUES ('message-redtone-2','thread-redtone','client','client-redtone','Thank you, Salman sahib. Does the company need to prepare anything before the order is announced?','en','in_app','delivered','2026-05-14T12:05:00+05:00');
INSERT INTO "messages" VALUES ('message-redtone-3','thread-redtone','staff','staff-owner','No fresh filing is required right now. I have uploaded the written reply and both payment receipts in the portal for your records.','en','in_app','delivered','2026-05-14T12:22:00+05:00');
INSERT INTO "messages" VALUES ('message-redtone-4','thread-redtone','client','client-redtone','Documents are visible. Please notify me as soon as the order is pronounced so we can brief management.','en','in_app','delivered','2026-05-14T12:40:00+05:00');
INSERT INTO "messages" VALUES ('message-redtone-5','thread-redtone','staff','staff-owner','Of course. I will attend the pronouncement and send you the order summary immediately after court.','en','in_app','delivered','2026-05-14T12:55:00+05:00');
INSERT INTO "messages" VALUES ('message-zubair-property-1','thread-zubair-property','staff','staff-owner','For the evidence hearing, please keep the original allotment letter, payment receipts, and CNIC copy ready.','en','in_app','delivered','2026-05-18T16:15:00+05:00');
INSERT INTO "messages" VALUES ('message-zubair-property-2','thread-zubair-property','client','client-redtone','I have arranged the originals and will bring them to your office one day before the hearing.','en','in_app','delivered','2026-05-18T16:31:00+05:00');
INSERT INTO "notification_consents" VALUES ('1641d450-898c-4b96-a94e-cd98c39265b2','firm-hassan-co','staff','staff-owner','sms','granted','demo_seed','2026-06-22T05:46:48.002Z',NULL,'2026-06-22T05:46:48.002Z');
INSERT INTO "notification_consents" VALUES ('bd8768b4-3122-4f14-8fa4-11af822a6261','firm-hassan-co','staff','staff-owner','email','granted','demo_seed','2026-06-22T05:46:48.002Z',NULL,'2026-06-22T05:46:48.002Z');
INSERT INTO "notification_consents" VALUES ('3719134b-d103-4f7f-a282-a157e67523c8','firm-hassan-co','staff','staff-lawyer','sms','granted','demo_seed','2026-06-22T05:46:48.002Z',NULL,'2026-06-22T05:46:48.002Z');
INSERT INTO "notification_consents" VALUES ('c63b93e5-8616-4a96-b360-12630996190b','firm-hassan-co','staff','staff-lawyer','email','granted','demo_seed','2026-06-22T05:46:48.002Z',NULL,'2026-06-22T05:46:48.002Z');
INSERT INTO "notification_consents" VALUES ('1f2fbad3-b2c4-47ff-aa56-ccb46cb5b3e4','firm-hassan-co','staff','staff-assistant','sms','granted','demo_seed','2026-06-22T05:46:48.002Z',NULL,'2026-06-22T05:46:48.002Z');
INSERT INTO "notification_consents" VALUES ('2a3caa9e-c82a-4829-955d-e884b809b740','firm-hassan-co','staff','staff-assistant','email','granted','demo_seed','2026-06-22T05:46:48.002Z',NULL,'2026-06-22T05:46:48.002Z');
INSERT INTO "notification_consents" VALUES ('7eb0d737-036a-489c-afc1-95af92baeeea','firm-hassan-co','client','client-redtone','sms','granted','demo_seed','2026-06-22T05:46:48.002Z',NULL,'2026-06-22T05:46:48.002Z');
INSERT INTO "notification_preferences" VALUES ('140ac36f-24ce-4c27-ae1f-01e32e6180c2','firm-hassan-co','staff','staff-owner',1,1,NULL,'2026-06-22T05:46:48.002Z');
INSERT INTO "notification_preferences" VALUES ('adf5695e-dc5d-44c8-a766-08707bcb4949','firm-hassan-co','staff','staff-lawyer',1,1,NULL,'2026-06-22T05:46:48.002Z');
INSERT INTO "notification_preferences" VALUES ('f548dc1e-c9ac-42a4-b829-c9866eb42764','firm-hassan-co','staff','staff-assistant',1,1,NULL,'2026-06-22T05:46:48.002Z');
INSERT INTO "notification_preferences" VALUES ('7a4e3510-da38-4b72-9e3c-e5c7cebb079d','firm-hassan-co','client','client-redtone',0,1,NULL,'2026-06-22T05:46:48.002Z');
INSERT INTO "notification_templates" VALUES ('lawyer_next_day_agenda','email',1,'Legal Bhai: tomorrow''s court agenda','Your next-day agenda:
{{payload}}',1,'2026-06-21T06:02:59.333Z');
INSERT INTO "notification_templates" VALUES ('lawyer_next_day_agenda','sms',1,'','Legal Bhai next-day agenda:
{{payload}}',1,'2026-06-21T06:02:59.333Z');
INSERT INTO "notification_templates" VALUES ('client_hearing_reminder','sms',1,'','Legal Bhai hearing reminder. Your hearing is scheduled in approximately 24 hours.
{{payload}}',1,'2026-06-21T06:02:59.333Z');
INSERT INTO "notification_templates" VALUES ('post_hearing_update','sms',1,'','Legal Bhai matter update. Your lawyer posted a hearing update.
{{payload}}',1,'2026-06-21T06:02:59.333Z');
INSERT INTO "notification_templates" VALUES ('portal_access_token','sms',1,'','Legal Bhai client portal access:
{{payload}}',1,'2026-06-21T06:02:59.333Z');
INSERT INTO "product_users" VALUES ('staff-owner','03001234567','ahmed@hassanco.pk','Advocate Salman Hassan','en','active','2026-06-22T05:46:48.002Z');
INSERT INTO "product_users" VALUES ('staff-lawyer','03007654321','sana@hassanco.pk','Sana Malik','en','active','2026-06-22T05:46:48.002Z');
INSERT INTO "product_users" VALUES ('staff-assistant','03001112222','hamza@hassanco.pk','Hamza Sheikh','en','active','2026-06-22T05:46:48.002Z');
INSERT INTO "time_entries" VALUES ('time-redtone','firm-hassan-co','matter-redtone','staff-owner','2026-05-14T12:30:00+05:00',95,'High Court appearance, order-pronouncement note, and client update',1,'2026-06-22T05:46:48.002Z');
INSERT INTO "time_entries" VALUES ('time-zubair-property','firm-hassan-co','matter-farooq','staff-owner','2026-05-18T15:30:00+05:00',45,'Witness preparation call and evidence checklist',1,'2026-06-22T05:46:48.002Z');
CREATE UNIQUE INDEX IF NOT EXISTS "idx_client_memberships_unique" ON "client_memberships" (
	"client_account_id",
	"matter_id"
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_product_users_email" ON "product_users" (
	"email"
) WHERE "email" IS NOT NULL;
COMMIT;
