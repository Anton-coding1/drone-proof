import { createFileRoute, redirect } from "@tanstack/react-router";

// Demo version: sensors and site monitoring are not part of this demo.
export const Route = createFileRoute("/monitor")({
  beforeLoad: () => {
    throw redirect({ to: "/demo", replace: true });
  },
});
