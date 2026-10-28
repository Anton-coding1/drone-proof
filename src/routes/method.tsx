import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage, pageHead } from "@/components/site/Placeholder";

export const Route = createFileRoute("/method")({
  head: () => pageHead("Method & limitations", "How results are produced, how confident they are, and where they stop."),
  component: () => <PlaceholderPage eyebrow="Method" title="Method & limitations" intro="How results are produced, how confident they are, and where they stop." />,
});
