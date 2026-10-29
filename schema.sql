-- Personal Writing Website — D1 Schema

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  content TEXT NOT NULL,
  rendered_html TEXT NOT NULL,
  tags TEXT DEFAULT '[]',
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'published')),
  featured INTEGER DEFAULT 0,
  cover_variant TEXT,
  cover_accent TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  published_at TEXT,
  revision INTEGER NOT NULL DEFAULT 1,
  reading_excerpt TEXT
);

CREATE INDEX IF NOT EXISTS idx_posts_slug ON posts(slug);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_published_at ON posts(published_at);

-- Private working copies. New essays have an id here before any public posts row
-- exists. Existing essays retain their original posts.id throughout publication.
CREATE TABLE IF NOT EXISTS post_drafts (
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

-- Older application versions and direct database writers may still update
-- public rows during rollback. Advance revisions to protect private working
-- copies; updating revision alone does not retrigger this trigger.
CREATE TRIGGER IF NOT EXISTS posts_editor_revision
AFTER UPDATE OF slug, title, description, reading_excerpt, content, rendered_html, tags, status,
  featured, cover_variant, cover_accent, created_at, updated_at, published_at ON posts
BEGIN
  UPDATE posts SET revision = OLD.revision + 1
    WHERE id = NEW.id AND revision = OLD.revision;
  -- This exact draft, or a visibility-only change from its current base, can
  -- safely advance its base. Existing divergent conflicts remain detectable.
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

CREATE TRIGGER IF NOT EXISTS posts_editor_first_publication
AFTER INSERT ON posts
BEGIN
  UPDATE post_drafts SET base_revision = NEW.revision
    WHERE id = NEW.id AND title IS NEW.title AND slug IS NEW.slug
      AND reading_excerpt IS NEW.reading_excerpt
      AND description IS NEW.description AND content IS NEW.content
      AND tags IS NEW.tags AND featured IS NEW.featured
      AND cover_variant IS NEW.cover_variant AND cover_accent IS NEW.cover_accent;
END;
