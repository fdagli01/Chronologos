ALTER TABLE library_entries ADD COLUMN setting_latitude REAL CHECK (setting_latitude BETWEEN -90 AND 90);
ALTER TABLE library_entries ADD COLUMN setting_longitude REAL CHECK (setting_longitude BETWEEN -180 AND 180);
ALTER TABLE library_entries ADD COLUMN setting_label TEXT;
ALTER TABLE library_entries ADD COLUMN setting_source TEXT;
ALTER TABLE library_entries ADD COLUMN setting_confidence TEXT CHECK (setting_confidence IN ('high', 'medium', 'low'));
ALTER TABLE library_entries ADD COLUMN setting_status TEXT CHECK (setting_status IN ('confirmed', 'nonfiction', 'fictional', 'ambiguous'));
