# Roadmap

- [x] Answer: what Lovable Cloud does for this project
- [x] Remove leftover scratch table `public.zz_probe` from the backend (dropped; its SQL/snapshot files deleted)
- [x] Confirm the three demo cases load through the running app (`/evidence#cases` lists all three; a case file opens with finding + audit trail)
- [ ] Clean the stale `0002_zz_probe` line from `drizzle/migrations/meta/_journal.json` — the file is owned by the backend migration tool and refuses direct edits
