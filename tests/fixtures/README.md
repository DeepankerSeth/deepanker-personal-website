# Local verification fixtures

`public-captures` retains the exact four published HTML/text captures used for content-integrity checks. These are complete public documents, not original Markdown or a production backup. Never republish them through the editor.

`sample-posts.sql` contains synthetic starter posts only, used by isolated publishing tests.

`pre-working-copy-schema.sql` is the exact schema from repository commit `0e32b473231e27a4b664eecd8db7ed294efa544a`, before migration0003. Its SHA256 is `90f7408a24a8466dd330c7ec59a46d85dce2b32bd4738431b08df9963622a557`. Keeping it here makes migration verification independent of Git history. `schema.sql` at project root is the complete fresh-database schema; do not apply additive migrations to that newly initialized schema.
