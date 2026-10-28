import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage, pageHead } from "@/components/site/Placeholder";

export const Route = createFileRoute("/evidence")({
  head: () => pageHead("Incident evidence", "An independent account of the GPS environment at the time and place of an incident."),
  component: () => <PlaceholderPage eyebrow="Product" title="Incident evidence" intro="An independent account of the GPS environment at the time and place of an incident." />,
});
