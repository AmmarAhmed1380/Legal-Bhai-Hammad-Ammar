BEGIN;

CREATE TABLE court_registry (
  id text PRIMARY KEY,
  display_name text NOT NULL,
  jurisdiction text NOT NULL DEFAULT 'Pakistan',
  automation_provider text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tracked_case_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  matter_id uuid NOT NULL UNIQUE REFERENCES matters(id) ON DELETE CASCADE,
  court_id text NOT NULL REFERENCES court_registry(id),
  raw_case_number text NOT NULL,
  normalized_case_number text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (firm_id, court_id, normalized_case_number)
);

INSERT INTO court_registry (id, display_name, jurisdiction, automation_provider)
VALUES ('ihc', 'Islamabad High Court', 'Islamabad Capital Territory', 'ihc')
ON CONFLICT (id) DO UPDATE SET
  display_name = excluded.display_name,
  jurisdiction = excluded.jurisdiction,
  automation_provider = excluded.automation_provider,
  updated_at = now();

INSERT INTO court_registry (id, display_name)
SELECT DISTINCT court_id, court_id
FROM matters
ON CONFLICT (id) DO NOTHING;

INSERT INTO tracked_case_references (
  firm_id,
  matter_id,
  court_id,
  raw_case_number,
  normalized_case_number
)
SELECT firm_id, id, court_id, raw_case_number, normalized_case_number
FROM matters
ON CONFLICT (matter_id) DO UPDATE SET
  court_id = excluded.court_id,
  raw_case_number = excluded.raw_case_number,
  normalized_case_number = excluded.normalized_case_number,
  updated_at = now();

CREATE FUNCTION sync_tracked_case_reference() RETURNS trigger AS $$
BEGIN
  INSERT INTO court_registry (id, display_name)
  VALUES (NEW.court_id, NEW.court_id)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO tracked_case_references (
    firm_id,
    matter_id,
    court_id,
    raw_case_number,
    normalized_case_number
  )
  VALUES (
    NEW.firm_id,
    NEW.id,
    NEW.court_id,
    NEW.raw_case_number,
    NEW.normalized_case_number
  )
  ON CONFLICT (matter_id) DO UPDATE SET
    firm_id = excluded.firm_id,
    court_id = excluded.court_id,
    raw_case_number = excluded.raw_case_number,
    normalized_case_number = excluded.normalized_case_number,
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER matters_sync_tracked_case_reference
AFTER INSERT OR UPDATE OF firm_id, court_id, raw_case_number, normalized_case_number
ON matters
FOR EACH ROW
EXECUTE FUNCTION sync_tracked_case_reference();

CREATE TABLE notification_templates (
  template_key text NOT NULL,
  channel text NOT NULL,
  version integer NOT NULL,
  subject_template text NOT NULL,
  body_template text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (template_key, channel, version),
  CONSTRAINT notification_templates_channel_check CHECK (channel IN ('email', 'sms')),
  CONSTRAINT notification_templates_version_check CHECK (version > 0)
);

INSERT INTO notification_templates (
  template_key,
  channel,
  version,
  subject_template,
  body_template
)
VALUES
  ('lawyer_next_day_agenda', 'email', 1, 'LegalBahi: tomorrow''s court agenda', E'Your next-day agenda:\n{{payload}}'),
  ('lawyer_next_day_agenda', 'sms', 1, '', E'LegalBahi next-day agenda:\n{{payload}}'),
  ('client_hearing_reminder', 'sms', 1, '', E'LegalBahi hearing reminder. Your hearing is scheduled in approximately 24 hours.\n{{payload}}'),
  ('post_hearing_update', 'sms', 1, '', E'LegalBahi matter update. Your lawyer posted a hearing update.\n{{payload}}')
ON CONFLICT (template_key, channel, version) DO NOTHING;

CREATE TABLE notification_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  actor_type text NOT NULL,
  actor_id uuid NOT NULL,
  channel text NOT NULL,
  status text NOT NULL,
  source text NOT NULL,
  granted_at timestamptz,
  revoked_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (firm_id, actor_type, actor_id, channel),
  CONSTRAINT notification_consents_actor_type_check CHECK (actor_type IN ('staff', 'client')),
  CONSTRAINT notification_consents_channel_check CHECK (channel IN ('email', 'sms')),
  CONSTRAINT notification_consents_status_check CHECK (status IN ('granted', 'revoked')),
  CONSTRAINT notification_consents_dates_check CHECK (
    (status = 'granted' AND granted_at IS NOT NULL AND revoked_at IS NULL)
    OR (status = 'revoked' AND revoked_at IS NOT NULL)
  )
);

ALTER TABLE notification_jobs
  ADD COLUMN template_version integer NOT NULL DEFAULT 1,
  ADD CONSTRAINT notification_jobs_template_fk
    FOREIGN KEY (template_key, channel, template_version)
    REFERENCES notification_templates(template_key, channel, version);

ALTER TABLE client_accounts
  DROP CONSTRAINT client_accounts_status_check,
  ADD CONSTRAINT client_accounts_status_check CHECK (status IN ('active', 'invited', 'archived'));

INSERT INTO schema_migrations (version)
VALUES ('004_registry_and_notification_templates')
ON CONFLICT (version) DO NOTHING;

COMMIT;
