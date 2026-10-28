import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage, pageHead } from "@/components/site/Placeholder";

export const Route = createFileRoute("/accessibility")({
  head: () => pageHead("Accessibility", "Our commitment to an accessible product and how to report a barrier."),
  component: () => <PlaceholderPage eyebrow="Legal" title="Accessibility" intro="Our commitment to an accessible product and how to report a barrier." />,
});
