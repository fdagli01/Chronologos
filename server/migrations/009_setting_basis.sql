ALTER TABLE library_entries ADD COLUMN setting_basis TEXT CHECK (setting_basis IN ('story_location', 'writing_city'));
ALTER TABLE library_entries ADD COLUMN setting_note TEXT;
