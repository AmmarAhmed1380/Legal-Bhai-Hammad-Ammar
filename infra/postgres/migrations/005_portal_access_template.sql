INSERT INTO notification_templates (template_key, channel, version, subject_template, body_template, enabled)
VALUES
  ('portal_access_token', 'sms', 1, '', E'LegalBahi client portal access:\n{{payload}}', true)
ON CONFLICT (template_key, channel, version) DO NOTHING;
