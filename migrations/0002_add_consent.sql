-- Persist follow-up consent on lead rows. CV downloads (and any future gated form)
-- set this to 1 when the user checks the consent box; contact-form rows stay 0.
-- Non-destructive add-column; SQLite requires a default on a NOT NULL add.
ALTER TABLE contact_messages ADD COLUMN consent INTEGER NOT NULL DEFAULT 0;
