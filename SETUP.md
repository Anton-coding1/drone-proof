# Setting up this copy of Witnessmark

This project is a copy of Witnessmark (demo version). The code is all here; the database and secrets
belong to each Lovable project, so they need setting up once.

1. In Lovable, turn on **Lovable Cloud** for this project.
2. Ask Lovable: "Apply the database migrations in drizzle/migrations to Lovable Cloud (tables scenarios,
   drone_points, sky_events, sky_hexes, with their row-level security and the simulated demo data)."
3. Then ask: "Change row-level security on scenarios and drone_points so that anon and authenticated users can
   only SELECT rows where the scenario has is_simulated = true (for drone_points, only rows whose scenario
   belongs to a simulated scenario). Keep service_role full access. Do not change any app code."
4. Optional secrets (Lovable Cloud > Secrets): `ADMIN_IMPORT_TOKEN` (24+ random characters, turns on
   /admin/import) and `ANTHROPIC_API_KEY` (AI-drafted narratives; otherwise Lovable AI is used).
5. Put your own contact email in `src/lib/site.ts` (`CONTACT_EMAIL`).
6. Publish.

Check: open /demo, download a sample file for each feature and upload it; each should give the result listed.
