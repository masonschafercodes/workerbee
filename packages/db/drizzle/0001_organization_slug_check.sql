ALTER TABLE "organization"
  ADD CONSTRAINT "organization_slug_format"
  CHECK ("slug" ~ '^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$');
