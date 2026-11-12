ALTER TABLE contact ADD COLUMN status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved'));
ALTER TABLE contact ADD COLUMN note text NOT NULL DEFAULT '';
ALTER TABLE contact ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
