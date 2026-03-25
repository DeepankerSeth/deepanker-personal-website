-- Additive migration for D1 databases created before V2 cover metadata existed.
-- Run this only on databases that do not already have both columns.

ALTER TABLE posts ADD COLUMN cover_variant TEXT;
ALTER TABLE posts ADD COLUMN cover_accent TEXT;
