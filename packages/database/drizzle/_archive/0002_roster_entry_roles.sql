ALTER TABLE "roster_entry"
ADD COLUMN "roles" jsonb DEFAULT '[]'::jsonb NOT NULL;
