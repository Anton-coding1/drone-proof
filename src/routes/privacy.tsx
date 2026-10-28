import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage, pageHead } from "@/components/site/Placeholder";

export const Route = createFileRoute("/privacy")({
  head: () => pageHead("Privacy", "What personal data Witnessmark processes and your rights over it."),
  component: () => <PlaceholderPage eyebrow="Legal" title="Privacy" intro="What personal data Witnessmark processes and your rights over it." />,
});
