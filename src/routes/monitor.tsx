import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage, pageHead } from "@/components/site/Placeholder";

export const Route = createFileRoute("/monitor")({
  head: () => pageHead("Site monitoring", "Continuous watch on GPS interference at places that rely on it."),
  component: () => <PlaceholderPage eyebrow="Product" title="Site monitoring" intro="Continuous watch on GPS interference at places that rely on it." />,
});
