BEGIN;

DELETE FROM app_sessions
WHERE auth_method = 'portal_otp_upgrade';

ALTER TABLE app_sessions
  DROP CONSTRAINT IF EXISTS app_sessions_auth_method_check;

ALTER TABLE app_sessions
  ADD CONSTRAINT app_sessions_auth_method_check
  CHECK (auth_method IN ('staff_otp', 'staff_magic_link', 'client_otp'));

ALTER TABLE portal_links
  DROP COLUMN IF EXISTS verified_at;

UPDATE ingestion_runs
SET status = 'needs_review'
WHERE status = 'reconciled';

ALTER TABLE ingestion_runs
  DROP CONSTRAINT IF EXISTS ingestion_runs_status_check;

ALTER TABLE ingestion_runs
  ADD CONSTRAINT ingestion_runs_status_check
  CHECK (status IN ('completed', 'needs_review'));

ALTER TABLE ingestion_runs
  DROP COLUMN IF EXISTS reconciled_at;

INSERT INTO schema_migrations (version)
VALUES ('005_remove_legacy_pilot_state')
ON CONFLICT (version) DO NOTHING;

COMMIT;
