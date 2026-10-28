import { createFileRoute, redirect } from "@tanstack/react-router";

// Old address kept so existing links still work.
export const Route = createFileRoute("/droneproof")({
  beforeLoad: ({ location }) => {
    throw redirect({ to: "/evidence", ...(location.hash ? { hash: location.hash } : {}), replace: true });
  },
});
