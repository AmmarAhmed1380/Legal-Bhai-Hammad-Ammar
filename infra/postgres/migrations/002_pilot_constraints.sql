BEGIN;

ALTER TABLE firms
  ADD CONSTRAINT firms_status_check CHECK (status IN ('active', 'trial'));
ALTER TABLE product_users
  ADD CONSTRAINT product_users_language_check CHECK (language IN ('en', 'ur')),
  ADD CONSTRAINT product_users_status_check CHECK (status IN ('active', 'invited'));
ALTER TABLE firm_memberships
  ADD CONSTRAINT firm_memberships_role_check CHECK (role IN ('owner', 'lawyer', 'assistant', 'billing'));
ALTER TABLE pilot_invites
  ADD CONSTRAINT pilot_invites_status_check CHECK (status IN ('invited', 'accepted', 'revoked'));
ALTER TABLE otp_requests
  ADD CONSTRAINT otp_requests_actor_type_check CHECK (actor_type IN ('staff', 'client')),
  ADD CONSTRAINT otp_requests_attempt_count_check CHECK (attempt_count BETWEEN 0 AND 5);
ALTER TABLE app_sessions
  ADD CONSTRAINT app_sessions_actor_type_check CHECK (actor_type IN ('staff', 'client')),
  ADD CONSTRAINT app_sessions_auth_method_check CHECK (auth_method IN ('staff_otp', 'staff_magic_link', 'client_otp', 'portal_otp_upgrade'));
ALTER TABLE client_accounts
  ADD CONSTRAINT client_accounts_language_check CHECK (language IN ('en', 'ur')),
  ADD CONSTRAINT client_accounts_status_check CHECK (status IN ('active', 'invited'));
ALTER TABLE matters
  ADD CONSTRAINT matters_type_check CHECK (matter_type IN ('litigation', 'advisory', 'arbitration')),
  ADD CONSTRAINT matters_status_check CHECK (status IN ('open', 'on_hold', 'closed'));
ALTER TABLE matter_parties
  ADD CONSTRAINT matter_parties_type_check CHECK (party_type IN ('petitioner', 'respondent', 'applicant', 'other'));
ALTER TABLE messages
  ADD CONSTRAINT messages_sender_type_check CHECK (sender_type IN ('staff', 'client')),
  ADD CONSTRAINT messages_language_check CHECK (language IN ('en', 'ur')),
  ADD CONSTRAINT messages_delivery_channel_check CHECK (delivery_channel IN ('in_app', 'sms')),
  ADD CONSTRAINT messages_delivery_state_check CHECK (delivery_state IN ('pending', 'delivered', 'failed'));
ALTER TABLE documents
  ADD CONSTRAINT documents_type_check CHECK (type IN ('hearing_order', 'pleading', 'invoice', 'evidence', 'note', 'general')),
  ADD CONSTRAINT documents_ocr_status_check CHECK (ocr_status IN ('completed', 'pending', 'failed', 'missing_file'));
ALTER TABLE portal_links
  ADD CONSTRAINT portal_links_expiry_check CHECK (expires_at > created_at);
ALTER TABLE calendar_items
  ADD CONSTRAINT calendar_items_confidence_check CHECK (source_confidence BETWEEN 0 AND 1),
  ADD CONSTRAINT calendar_items_conflict_state_check CHECK (conflict_state IN ('none', 'possible'));
ALTER TABLE court_sources
  ADD CONSTRAINT court_sources_mode_check CHECK (ingestion_mode IN ('automation', 'ops_assisted')),
  ADD CONSTRAINT court_sources_status_check CHECK (status IN ('pending', 'live', 'degraded', 'manual_review'));
ALTER TABLE cause_list_entries
  ADD CONSTRAINT cause_list_entries_type_check CHECK (list_type IN ('regular', 'supplementary', 'urgent'));
ALTER TABLE matter_matches
  ADD CONSTRAINT matter_matches_confidence_check CHECK (confidence BETWEEN 0 AND 1),
  ADD CONSTRAINT matter_matches_state_check CHECK (state IN ('auto_matched', 'approved', 'rejected'));
ALTER TABLE ingestion_runs
  ADD CONSTRAINT ingestion_runs_status_check CHECK (status IN ('completed', 'needs_review', 'reconciled'));
ALTER TABLE notification_preferences
  ADD CONSTRAINT notification_preferences_actor_type_check CHECK (actor_type IN ('staff', 'client'));
ALTER TABLE notification_jobs
  ADD CONSTRAINT notification_jobs_actor_type_check CHECK (actor_type IN ('staff', 'client')),
  ADD CONSTRAINT notification_jobs_channel_check CHECK (channel IN ('email', 'sms')),
  ADD CONSTRAINT notification_jobs_status_check CHECK (status IN ('pending', 'processing', 'retrying', 'sent', 'failed')),
  ADD CONSTRAINT notification_jobs_attempt_count_check CHECK (attempt_count BETWEEN 0 AND 3);
ALTER TABLE notification_attempts
  ADD CONSTRAINT notification_attempts_status_check CHECK (status IN ('retrying', 'sent', 'failed'));
ALTER TABLE csv_import_jobs
  ADD CONSTRAINT csv_import_jobs_status_check CHECK (status IN ('preview', 'confirmed')),
  ADD CONSTRAINT csv_import_jobs_counts_check CHECK (
    total_rows >= 0 AND accepted_rows >= 0 AND rejected_rows >= 0
    AND accepted_rows + rejected_rows = total_rows
  );
ALTER TABLE csv_import_rows
  ADD CONSTRAINT csv_import_rows_state_check CHECK (state IN ('accepted', 'rejected', 'imported'));

INSERT INTO schema_migrations (version) VALUES ('002_pilot_constraints') ON CONFLICT (version) DO NOTHING;
COMMIT;
