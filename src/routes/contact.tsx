import { createFileRoute, redirect } from "@tanstack/react-router";

// Demo version: outreach pages are switched off. The full page is kept on the
// snapshot-full-site-2026-10-28 branch.
export const Route = createFileRoute("/contact")({
  beforeLoad: () => {
    throw redirect({ to: "/demo", replace: true });
  },
});
