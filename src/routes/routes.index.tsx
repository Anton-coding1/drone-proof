import { createFileRoute, redirect } from "@tanstack/react-router";

// Old address kept so existing links still work.
export const Route = createFileRoute("/routes/")({
  beforeLoad: ({ location }) => {
    throw redirect({ to: "/pre-flight", ...(location.hash ? { hash: location.hash } : {}), replace: true });
  },
});
