import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage, pageHead } from "@/components/site/Placeholder";

export const Route = createFileRoute("/about")({
  head: () => pageHead("About", "Why an independent record of GPS interference matters."),
  component: () => <PlaceholderPage eyebrow="Company" title="About" intro="Why an independent record of GPS interference matters." />,
});
