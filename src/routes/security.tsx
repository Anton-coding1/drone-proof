import { createFileRoute, redirect } from "@tanstack/react-router";

// Old address kept so existing links still work.
export const Route = createFileRoute("/security")({
  beforeLoad: () => {
    throw redirect({ to: "/trust", replace: true });
  },
});
