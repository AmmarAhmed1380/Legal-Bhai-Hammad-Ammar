BEGIN;

CREATE INDEX IF NOT EXISTS idx_matters_firm_id ON matters(firm_id);
CREATE INDEX IF NOT EXISTS idx_hearings_matter_id ON hearings(matter_id);
CREATE INDEX IF NOT EXISTS idx_hearings_date ON hearings(listed_at);
CREATE INDEX IF NOT EXISTS idx_documents_matter_id ON documents(matter_id);

INSERT INTO schema_migrations (version) VALUES ('007_performance_indexes') ON CONFLICT (version) DO NOTHING;

COMMIT;
