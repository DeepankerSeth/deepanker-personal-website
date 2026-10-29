-- Apply once to an existing posts database, after confirming cover metadata
-- columns exist. Fresh installations use schema.sql instead. This migration
-- preserves all existing content, IDs, slugs, statuses, and timestamps.
ALTER TABLE posts ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE posts ADD COLUMN reading_excerpt TEXT;

CREATE TABLE post_drafts (
  id TEXT PRIMARY KEY NOT NULL,
  base_revision INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL DEFAULT '',
  slug TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  reading_excerpt TEXT,
  content TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  featured INTEGER NOT NULL DEFAULT 0,
  cover_variant TEXT,
  cover_accent TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK(base_revision >= 0 AND version > 0)
);

CREATE TRIGGER posts_editor_revision
AFTER UPDATE OF slug, title, description, reading_excerpt, content, rendered_html, tags, status,
  featured, cover_variant, cover_accent, created_at, updated_at, published_at ON posts
BEGIN
  UPDATE posts SET revision = OLD.revision + 1
    WHERE id = NEW.id AND revision = OLD.revision;
  UPDATE post_drafts SET base_revision = (SELECT revision FROM posts WHERE id = NEW.id)
    WHERE id = NEW.id AND (
      (title IS NEW.title AND slug IS NEW.slug AND description IS NEW.description
       AND reading_excerpt IS NEW.reading_excerpt
       AND content IS NEW.content AND tags IS NEW.tags AND featured IS NEW.featured
       AND cover_variant IS NEW.cover_variant AND cover_accent IS NEW.cover_accent)
      OR
      (base_revision = OLD.revision
       AND OLD.title IS NEW.title AND OLD.slug IS NEW.slug AND OLD.description IS NEW.description
       AND OLD.reading_excerpt IS NEW.reading_excerpt
       AND OLD.content IS NEW.content AND OLD.tags IS NEW.tags AND OLD.featured IS NEW.featured
       AND OLD.cover_variant IS NEW.cover_variant AND OLD.cover_accent IS NEW.cover_accent)
    );
END;

CREATE TRIGGER posts_editor_first_publication
AFTER INSERT ON posts
BEGIN
  UPDATE post_drafts SET base_revision = NEW.revision
    WHERE id = NEW.id AND title IS NEW.title AND slug IS NEW.slug
      AND reading_excerpt IS NEW.reading_excerpt
      AND description IS NEW.description AND content IS NEW.content
      AND tags IS NEW.tags AND featured IS NEW.featured
      AND cover_variant IS NEW.cover_variant AND cover_accent IS NEW.cover_accent;
END;
