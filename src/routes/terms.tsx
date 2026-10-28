import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage, pageHead } from "@/components/site/Placeholder";

export const Route = createFileRoute("/terms")({
  head: () => pageHead("Terms", "The terms for using the Witnessmark demo."),
  component: () => <PlaceholderPage eyebrow="Legal" title="Terms" intro="The terms for using the Witnessmark demo." />,
});
