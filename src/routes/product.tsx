import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage, pageHead } from "@/components/site/Placeholder";

export const Route = createFileRoute("/product")({
  head: () => pageHead("Product overview", "One independent record of GPS jamming and spoofing, turned into three decisions."),
  component: () => <PlaceholderPage eyebrow="Product" title="Product overview" intro="One independent record of GPS jamming and spoofing, turned into three decisions." />,
});
