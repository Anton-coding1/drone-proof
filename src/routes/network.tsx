import { createFileRoute, redirect } from "@tanstack/react-router";

// Demo version: sensors and site monitoring are not part of this demo.
export const Route = createFileRoute("/network")({
  beforeLoad: () => {
    throw redirect({ to: "/product", replace: true });
  },
});
