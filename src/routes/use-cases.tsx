import { createFileRoute, redirect } from "@tanstack/react-router";

// Old address kept so existing links still work.
export const Route = createFileRoute("/use-cases")({
  beforeLoad: () => {
    throw redirect({ to: "/evidence", replace: true });
  },
});
