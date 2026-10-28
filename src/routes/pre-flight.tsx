import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage, pageHead } from "@/components/site/Placeholder";

export const Route = createFileRoute("/pre-flight")({
  head: () => pageHead("Pre-flight check", "A clear GO, CAUTION or NO-GO on GPS conditions before a drone flies."),
  component: () => <PlaceholderPage eyebrow="Product" title="Pre-flight check" intro="A clear GO, CAUTION or NO-GO on GPS conditions before a drone flies." />,
});
