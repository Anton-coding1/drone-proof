import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage, pageHead } from "@/components/site/Placeholder";

export const Route = createFileRoute("/network")({
  head: () => pageHead("Ground sensors", "The street-level receivers that build the Witnessmark record."),
  component: () => <PlaceholderPage eyebrow="Product" title="Ground sensors" intro="The street-level receivers that build the Witnessmark record." />,
});
