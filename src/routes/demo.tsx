import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage, pageHead } from "@/components/site/Placeholder";

export const Route = createFileRoute("/demo")({
  head: () => pageHead("Try it with your data", "Upload a flight log or pick a place and see what Witnessmark returns."),
  component: () => <PlaceholderPage eyebrow="Demo" title="Try it with your data" intro="Upload a flight log or pick a place and see what Witnessmark returns." />,
});
