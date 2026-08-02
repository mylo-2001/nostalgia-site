ALTER TABLE messages
  DROP COLUMN IF EXISTS attachment_name,
  DROP COLUMN IF EXISTS attachment_mime,
  DROP COLUMN IF EXISTS attachment_size,
  DROP COLUMN IF EXISTS attachment_storage_name;
