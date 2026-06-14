BEGIN;

ALTER TABLE client_accounts
  DROP CONSTRAINT IF EXISTS client_accounts_phone_key;

INSERT INTO schema_migrations (version)
VALUES ('003_client_phone_workspace_scope')
ON CONFLICT (version) DO NOTHING;

COMMIT;
