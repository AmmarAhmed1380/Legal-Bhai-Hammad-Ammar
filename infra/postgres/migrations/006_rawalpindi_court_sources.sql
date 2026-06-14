BEGIN;

INSERT INTO court_registry (id, display_name, jurisdiction, automation_provider)
VALUES
  ('ihc', 'Islamabad High Court', 'Islamabad Capital Territory', 'ihc'),
  ('lhc-rawalpindi-bench', 'Lahore High Court Rawalpindi Bench', 'Punjab', 'lhc_rwp'),
  ('rwp-district-sessions', 'Rawalpindi District & Sessions Courts', 'Punjab', 'rwp_district'),
  ('rwp-civil-courts', 'Rawalpindi Civil Courts', 'Punjab', 'rwp_district'),
  ('rwp-family-courts', 'Rawalpindi Family Courts', 'Punjab', 'rwp_district'),
  ('rwp-criminal-magisterial', 'Rawalpindi Criminal & Magisterial Courts', 'Punjab', 'rwp_district')
ON CONFLICT (id) DO UPDATE SET
  display_name = excluded.display_name,
  jurisdiction = excluded.jurisdiction,
  automation_provider = excluded.automation_provider,
  status = 'active',
  updated_at = now();

INSERT INTO court_sources (id, court_id, source_type, ingestion_mode, status, metrics)
VALUES
  ('source-ihc', 'ihc', 'high_court', 'automation', 'pending', '{}'),
  ('source-lhc-rwp', 'lhc-rawalpindi-bench', 'high_court', 'automation', 'manual_review', '{}'),
  ('source-rwp-district', 'rwp-district-sessions', 'district', 'automation', 'manual_review', '{}')
ON CONFLICT (id) DO UPDATE SET
  court_id = excluded.court_id,
  source_type = excluded.source_type,
  ingestion_mode = excluded.ingestion_mode,
  status = court_sources.status,
  metrics = COALESCE(court_sources.metrics, '{}'::jsonb);

ALTER TABLE cause_list_entries
  ADD COLUMN IF NOT EXISTS court_id text;

UPDATE cause_list_entries cle
SET court_id = cs.court_id
FROM court_sources cs
WHERE cle.court_id IS NULL
  AND cle.court_source_id = cs.id;

ALTER TABLE documents
  DROP CONSTRAINT IF EXISTS documents_type_check;

ALTER TABLE documents
  ADD CONSTRAINT documents_type_check
  CHECK (type IN (
    'hearing_order',
    'pleading',
    'invoice',
    'evidence',
    'note',
    'general',
    'notice',
    'cnic',
    'vakalatnama',
    'receipt',
    'cause_list'
  ));

CREATE INDEX IF NOT EXISTS cause_list_entries_source_date_case_idx
  ON cause_list_entries (court_source_id, list_date, normalized_case_number);

CREATE INDEX IF NOT EXISTS cause_list_entries_court_date_case_idx
  ON cause_list_entries (court_id, list_date, normalized_case_number);

CREATE INDEX IF NOT EXISTS matter_matches_matter_state_idx
  ON matter_matches (matter_id, state);

CREATE INDEX IF NOT EXISTS audit_events_firm_created_idx
  ON audit_events (firm_id, created_at DESC);

CREATE INDEX IF NOT EXISTS documents_firm_matter_portal_idx
  ON documents (firm_id, matter_id, portal_visible);

CREATE INDEX IF NOT EXISTS notification_jobs_firm_status_scheduled_idx
  ON notification_jobs (firm_id, status, scheduled_at);

INSERT INTO schema_migrations (version)
VALUES ('006_rawalpindi_court_sources')
ON CONFLICT (version) DO NOTHING;

COMMIT;
