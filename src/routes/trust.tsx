import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage, pageHead } from "@/components/site/Placeholder";

export const Route = createFileRoute("/trust")({
  head: () => pageHead("Trust & security", "How Witnessmark protects, handles and deletes data."),
  component: () => <PlaceholderPage eyebrow="Trust" title="Trust & security" intro="How Witnessmark protects, handles and deletes data." />,
});
