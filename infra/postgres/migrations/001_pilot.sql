BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE firms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  primary_city text NOT NULL,
  billing_plan text NOT NULL DEFAULT 'solo_plus',
  timezone text NOT NULL DEFAULT 'Asia/Karachi',
  status text NOT NULL DEFAULT 'trial',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE product_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL UNIQUE,
  email text UNIQUE,
  display_name text NOT NULL,
  language text NOT NULL DEFAULT 'en',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE firm_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES product_users(id) ON DELETE CASCADE,
  role text NOT NULL,
  permissions jsonb NOT NULL DEFAULT '[]',
  office_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (firm_id, user_id)
);

CREATE TABLE pilot_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL UNIQUE,
  email text,
  status text NOT NULL DEFAULT 'invited',
  invited_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz
);

CREATE TABLE otp_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type text NOT NULL,
  phone text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE magic_link_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES product_users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type text NOT NULL,
  actor_id uuid NOT NULL,
  firm_id uuid REFERENCES firms(id) ON DELETE CASCADE,
  auth_method text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE TABLE refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES app_sessions(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE TABLE client_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  phone text NOT NULL UNIQUE,
  display_name text NOT NULL,
  language text NOT NULL DEFAULT 'en',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (firm_id, phone)
);

CREATE TABLE matters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  court_id text NOT NULL,
  raw_case_number text NOT NULL,
  normalized_case_number text NOT NULL,
  title text NOT NULL,
  matter_type text NOT NULL DEFAULT 'litigation',
  stage text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  next_hearing_at timestamptz,
  lead_lawyer_id uuid REFERENCES product_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (firm_id, court_id, normalized_case_number)
);

CREATE TABLE matter_parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id uuid NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
  party_type text NOT NULL,
  display_name text NOT NULL,
  contact_ref uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE client_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id uuid NOT NULL REFERENCES client_accounts(id) ON DELETE CASCADE,
  matter_id uuid NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
  access_level text NOT NULL DEFAULT 'message',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_account_id, matter_id)
);

CREATE TABLE message_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id uuid NOT NULL UNIQUE REFERENCES matters(id) ON DELETE CASCADE,
  participant_type text NOT NULL DEFAULT 'firm_client',
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  sender_type text NOT NULL,
  sender_id uuid NOT NULL,
  body text NOT NULL,
  language text NOT NULL,
  delivery_channel text NOT NULL,
  delivery_state text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  matter_id uuid REFERENCES matters(id) ON DELETE SET NULL,
  folder_id text,
  type text NOT NULL,
  title text NOT NULL,
  storage_key text NOT NULL UNIQUE,
  mime_type text NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES product_users(id),
  ocr_status text NOT NULL,
  ocr_text text,
  search_text text,
  portal_visible boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE document_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  matter_id uuid NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, matter_id)
);

CREATE TABLE portal_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id uuid NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
  client_account_id uuid NOT NULL REFERENCES client_accounts(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES product_users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE hearings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id uuid NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
  listed_at timestamptz NOT NULL,
  outcome text NOT NULL,
  notes text NOT NULL,
  next_date date,
  courtroom text,
  bench text,
  source_type text NOT NULL,
  document_id uuid REFERENCES documents(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE calendar_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id uuid NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
  listed_at timestamptz NOT NULL,
  courtroom text,
  bench text,
  source_type text NOT NULL,
  source_confidence numeric(4,3) NOT NULL,
  conflict_state text NOT NULL DEFAULT 'none',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (matter_id, listed_at, source_type)
);

CREATE TABLE court_sources (
  id text PRIMARY KEY,
  court_id text NOT NULL UNIQUE,
  source_type text NOT NULL,
  ingestion_mode text NOT NULL,
  status text NOT NULL,
  last_successful_sync_at timestamptz,
  metrics jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cause_list_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  court_source_id text NOT NULL REFERENCES court_sources(id) ON DELETE CASCADE,
  list_date date NOT NULL,
  list_type text NOT NULL,
  normalized_case_number text NOT NULL,
  raw_case_number text NOT NULL,
  courtroom text,
  bench text,
  source_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE matter_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  matter_id uuid NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
  cause_list_entry_id uuid NOT NULL REFERENCES cause_list_entries(id) ON DELETE CASCADE,
  confidence numeric(4,3) NOT NULL,
  state text NOT NULL,
  reviewed_by uuid REFERENCES product_users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (matter_id, cause_list_entry_id)
);

CREATE TABLE ingestion_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  court_source_id text NOT NULL REFERENCES court_sources(id) ON DELETE CASCADE,
  court_id text NOT NULL,
  status text NOT NULL,
  rows_fetched integer NOT NULL,
  rows_parsed integer NOT NULL,
  rows_matched integer NOT NULL,
  parser_failures integer NOT NULL,
  unmatched_count integer NOT NULL,
  note text,
  started_at timestamptz NOT NULL,
  finished_at timestamptz NOT NULL,
  reconciled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  actor_type text NOT NULL,
  actor_id uuid NOT NULL,
  email_enabled boolean NOT NULL DEFAULT true,
  sms_enabled boolean NOT NULL DEFAULT true,
  opted_out_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (firm_id, actor_type, actor_id)
);

CREATE TABLE notification_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  actor_type text NOT NULL,
  actor_id uuid NOT NULL,
  channel text NOT NULL,
  template_key text NOT NULL,
  payload jsonb NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempt_count integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notification_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES notification_jobs(id) ON DELETE CASCADE,
  provider_id text,
  status text NOT NULL,
  error text,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE csv_import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES product_users(id),
  status text NOT NULL,
  total_rows integer NOT NULL,
  accepted_rows integer NOT NULL,
  rejected_rows integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz
);

CREATE TABLE csv_import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES csv_import_jobs(id) ON DELETE CASCADE,
  row_number integer NOT NULL,
  payload jsonb NOT NULL,
  normalized_case_number text,
  state text NOT NULL,
  error text,
  matter_id uuid REFERENCES matters(id) ON DELETE SET NULL
);

CREATE TABLE alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  actor_type text NOT NULL,
  actor_id uuid,
  object_type text NOT NULL,
  object_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX otp_requests_lookup_idx ON otp_requests (actor_type, phone, created_at DESC);
CREATE INDEX matters_firm_next_hearing_idx ON matters (firm_id, next_hearing_at);
CREATE INDEX documents_firm_matter_idx ON documents (firm_id, matter_id);
CREATE INDEX calendar_items_listed_idx ON calendar_items (listed_at);
CREATE INDEX notification_jobs_due_idx ON notification_jobs (status, scheduled_at);
CREATE INDEX matter_matches_review_idx ON matter_matches (firm_id, state);

INSERT INTO court_sources (id, court_id, source_type, ingestion_mode, status)
VALUES ('source-ihc', 'ihc', 'high_court', 'automation', 'pending');

INSERT INTO schema_migrations (version) VALUES ('001_pilot') ON CONFLICT (version) DO NOTHING;
COMMIT;
