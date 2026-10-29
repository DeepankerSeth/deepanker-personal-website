#!/usr/bin/env python3
"""Create NEW disposable local state; never production content or a backup."""
import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess
import uuid

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--persist-to", required=True, type=Path, help="New temporary directory only")
args = parser.parse_args()
target = args.persist_to.resolve()
if target.exists():
    parser.error("Refusing existing state. Choose a new temporary directory.")
os.umask(0o077)
# The builder validates private local/temporary ancestry and canonical captures.
subprocess.run([shutil.which("node") or "node", str(ROOT / "scripts/local-writing-fixture.mjs"),
                "--persist-to", str(target)], cwd=ROOT, check=True,
               env={**os.environ, "WRANGLER_SEND_METRICS": "false"})
databases = [file for file in (target / "v3/d1").glob("*/*.sqlite") if file.name != "metadata.sqlite"]
if len(databases) != 1:
    raise RuntimeError("Expected exactly one newly created fixture database")
database = databases[0]
draft_id = str(uuid.uuid4())
markdown = "\ufeff" + "\r\n".join([
    "# Local validation manuscript", "", "LOCAL QA ONLY — an unpublished working copy.", "",
    "māyā, avidyā, and Madhurādhipate akhilaṁ madhuram.", "",
    "One reference[^repeat] and the same note again[^repeat].", "",
    "> A block quotation with **emphasis** and a [local writing link](/writing/i-am/).", "",
    "1. First ordered point", "2. Second point", "", "- Unordered item", "- Another item", "",
    "```text", "WIDE_" + "0123456789" * 24, "```", "",
    "| Column | A deliberately wide column |", "| --- | --- |",
    "| Value | " + "wide-table-value-" * 14 + " |", "",
    "![Local favicon test image](/favicon.svg)", "",
    '<figure><img src="/favicon.svg" alt="Local figure image" width="680" height="680"><figcaption>Local validation caption.</figcaption></figure>', "",
    "A poem-like line  ", "A second preserved line  ", "A third line", "",
    "[^repeat]: A single note with **strong text**, used twice.", "",
])
document = {
    "title": "LOCAL QA — " + "X" * 289,
    "slug": "local-material-release-validation", "description": "Synthetic unpublished validation only.",
    "reading_excerpt": "One reference and the same note again.", "content": markdown,
    "tags": ["local-validation", "T" * 80], "featured": False,
    "cover_variant": None, "cover_accent": None,
}
assert len(document["title"]) == 300
now = dt.datetime.now(dt.timezone.utc).isoformat()
with sqlite3.connect(database) as db:
    assert db.execute("SELECT count(*) FROM posts WHERE status = 'published'").fetchone()[0] == 4
    assert db.execute("SELECT count(*) FROM post_drafts").fetchone()[0] == 0
    expected_ids = {"fixture-meditations", "fixture-war", "fixture-abstractions-of-illusion", "fixture-i-am"}
    assert {row[0] for row in db.execute("SELECT id FROM posts")} == expected_ids
    assert db.execute("SELECT count(*) FROM posts WHERE reading_excerpt IS NOT NULL").fetchone()[0] == 0
    before = db.execute("SELECT * FROM posts ORDER BY id").fetchall()
    db.execute("""INSERT INTO post_drafts
        (id,base_revision,version,title,slug,description,reading_excerpt,content,tags,featured,
         cover_variant,cover_accent,created_at,updated_at)
        VALUES (?,0,1,?,?,?,?,?,?,0,NULL,NULL,?,?)""",
        (draft_id, document["title"], document["slug"], document["description"],
         document["reading_excerpt"], markdown, json.dumps(document["tags"]), now, now))
    assert db.execute("SELECT * FROM posts ORDER BY id").fetchall() == before
    assert db.execute("SELECT count(*) FROM posts WHERE id = ?", (draft_id,)).fetchone()[0] == 0
    assert db.execute("SELECT content FROM post_drafts WHERE id = ?", (draft_id,)).fetchone()[0] == markdown
payload = {
    "purpose": "LOCAL synthetic unpublished edge-case fixture. Never a production import.",
    "id": draft_id, "document": document, "draftVersion": 1, "publishedRevision": 0,
    "contentSha256": hashlib.sha256(markdown.encode()).hexdigest(),
    "publicRowsUnchanged": True, "publicCount": 4, "privateCount": 1,
    "publicExcerptMetadata": "NULL; review fixtures do not override the accepted passage/art pairing",
    "astroPersistTo": str(target),
}
(target / "private-qa-fixture.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
(target / "private-qa.md").write_bytes(markdown.encode())
for file in (database, target / "private-qa-fixture.json", target / "private-qa.md"):
    file.chmod(0o600)
print(json.dumps({"persistTo": str(target), "privateDraftId": draft_id,
                  "publicCount": 4, "privateCount": 1}, indent=2))
