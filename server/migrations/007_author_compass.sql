ALTER TABLE library_entries ADD COLUMN latitude REAL CHECK (latitude BETWEEN -90 AND 90);
ALTER TABLE library_entries ADD COLUMN longitude REAL CHECK (longitude BETWEEN -180 AND 180);
ALTER TABLE library_entries ADD COLUMN location_label TEXT;
ALTER TABLE library_entries ADD COLUMN location_kind TEXT CHECK (location_kind IN ('birthplace', 'associated'));
