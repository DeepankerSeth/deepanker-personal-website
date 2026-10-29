#!/usr/bin/env python3
"""Rehearse additive 0003 on an isolated copy; this cannot access remote D1."""
import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--source", required=True, type=Path)
parser.add_argument("--out", required=True, type=Path, help="New directory under this project's ignored .local")
parser.add_argument("--project-legacy", action="store_true", help="Explicitly project already migrated local samples to original columns")
parser.add_argument("--report", required=True, type=Path, help="Sanitized evidence JSON; contains no row values")
args = parser.parse_args()
source, target, report = args.source.resolve(), args.out.resolve(), args.report.resolve()
private_root = ROOT / ".local"
legacy_root = ROOT / ".wrangler"
report_root = ROOT / "docs/verification/evidence"
if private_root.is_symlink() or legacy_root.is_symlink() or report_root.is_symlink():
    parser.error("Local private/evidence roots must not be symlinks")
if not any(source.is_relative_to(root) and source != root for root in (private_root, legacy_root)) or not source.is_file():
    parser.error("Source must be an existing SQLite file under this project's .local (or retained .wrangler)")
if not target.is_relative_to(private_root) or target == private_root or target.exists():
    parser.error("Output must be a NEW directory under this project's .local")
if not report.is_relative_to(report_root) or report == report_root:
    parser.error("Report must be under docs/verification/evidence")
if report.exists():
    parser.error("Refusing to overwrite an existing verification report")
os.umask(0o077)
target.mkdir(parents=True, mode=0o700)
backup = target / "source-backup.sqlite"
candidate = target / "migration-candidate.sqlite"
legacy_schema = (ROOT / "tests/fixtures/pre-working-copy-schema.sql").read_bytes()
migration = (ROOT / "migrations/0003_editor_working_copies.sql").read_bytes()
digest = lambda value: hashlib.sha256(value).hexdigest()
rows_digest = lambda value: digest(json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode())
read_only = sqlite3.connect(source.as_uri() + "?mode=ro", uri=True)
with sqlite3.connect(backup) as destination:
    read_only.backup(destination)
with sqlite3.connect(backup) as db:
    assert db.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
    columns = [row[1] for row in db.execute("PRAGMA table_info(posts)")]
    source_rows = db.execute("SELECT * FROM posts ORDER BY id").fetchall()
    source_private_count = db.execute("SELECT count(*) FROM post_drafts").fetchone()[0] if "revision" in columns else 0
    if "revision" in columns and not args.project_legacy:
        raise SystemExit("Source already migrated; --project-legacy required for a labeled sample projection")
    with sqlite3.connect(candidate) as rehearsal:
        if args.project_legacy:
            rehearsal.executescript(legacy_schema.decode())
            legacy_columns = [row[1] for row in rehearsal.execute("PRAGMA table_info(posts)")]
            if any(column not in columns for column in legacy_columns):
                raise RuntimeError("Source lacks a required legacy column")
            column_sql = ",".join('"' + column + '"' for column in legacy_columns)
            original = db.execute(f"SELECT {column_sql} FROM posts ORDER BY id").fetchall()
            placeholders = ",".join("?" for _ in legacy_columns)
            rehearsal.executemany(f"INSERT INTO posts ({column_sql}) VALUES ({placeholders})", original)
            rehearsal.commit()
        else:
            db.backup(rehearsal)
            legacy_columns = columns
            column_sql = ",".join('"' + column + '"' for column in legacy_columns)
            original = rehearsal.execute(f"SELECT {column_sql} FROM posts ORDER BY id").fetchall()
        rehearsal.executescript(migration.decode())
        actual = rehearsal.execute(f"SELECT {column_sql} FROM posts ORDER BY id").fetchall()
        assert actual == original, "Migration changed legacy column values"
        assert rehearsal.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
        assert rehearsal.execute("SELECT count(*) FROM posts WHERE revision != 1 OR reading_excerpt IS NOT NULL").fetchone()[0] == 0
        assert rehearsal.execute("SELECT count(*) FROM post_drafts").fetchone()[0] == 0
        triggers = [row[0] for row in rehearsal.execute("SELECT name FROM sqlite_master WHERE type='trigger' ORDER BY name")]
        assert triggers == ["posts_editor_first_publication", "posts_editor_revision"]
        migrated_columns = [row[1] for row in rehearsal.execute("PRAGMA table_info(posts)")]
    assert db.execute("SELECT * FROM posts ORDER BY id").fetchall() == source_rows
assert read_only.execute("SELECT * FROM posts ORDER BY id").fetchall() == source_rows, "Source changed during rehearsal"
read_only.close()
for file in (backup, candidate):
    file.chmod(0o600)
result = {
    "checkedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
    "scope": "LOCAL sample database only; no remote commands or credentials used.",
    "method": "SQLite read-only backup; explicit pre-0003 projection of local sample rows; apply only 0003" if args.project_legacy else "SQLite read-only backup; apply only 0003 to separate copy",
    "productionBackup": False, "actualProductionRehearsal": False,
    "sourceRelativePath": str(source.relative_to(ROOT)), "privateArtifactDirectory": str(target.relative_to(ROOT)),
    "legacySchemaSource": "tests/fixtures/pre-working-copy-schema.sql",
    "legacySchemaRevision": "0e32b473231e27a4b664eecd8db7ed294efa544a", "legacySchemaSha256": digest(legacy_schema),
    "migrationSha256": digest(migration), "sourceColumns": columns,
    "legacyColumnsCompared": legacy_columns, "migratedColumns": migrated_columns,
    "rowCount": len(original), "sourcePrivateCount": source_private_count,
    "beforeOriginalColumnsSha256": rows_digest(original), "afterOriginalColumnsSha256": rows_digest(actual),
    "allOriginalColumnValuesEqual": True, "sourceAllPostValuesUnchanged": True,
    "revisionDefaultOne": True, "readingExcerptDefaultNull": True,
    "postDraftsInitiallyEmpty": True, "triggers": triggers, "sqliteIntegrity": "ok",
    "backupSha256": digest(backup.read_bytes()), "candidateSha256": digest(candidate.read_bytes()),
    "artifactModes": "directory0700; SQLite files0600", "containsRowValues": False,
    "limitation": "An already migrated source was projected to legacy columns. This proves migration preservation for these local rows, not the unknown production schema or data." if args.project_legacy else "Local rows do not prove production schema, backup, or data compatibility.",
}
report.parent.mkdir(parents=True, exist_ok=True)
report.write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps({"rowsCompared": len(original), "allOriginalColumnValuesEqual": True,
                  "sourceUnchanged": True, "report": str(report.relative_to(ROOT))}, indent=2))
