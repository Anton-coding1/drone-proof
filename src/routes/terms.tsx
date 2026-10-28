import { createFileRoute } from "@tanstack/react-router";
import { Page } from "@/components/wm/Page";
import { Container, PageIntro, Prose } from "@/components/wm/ui";
import { CONTACT_EMAIL, DISCLAIMER } from "@/lib/site";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: seo({ title: "Terms of use", description: "Terms for using the Witnessmark prototype." }) }),
  component: Terms,
});

function Terms() {
  return (
    <Page>
      <PageIntro eyebrow="Legal" title="Terms of use" lead="The plain-English version: this is a prototype, use it as decision support only, and don't rely on it as your only safety measure or as legal proof." />
      <Container narrow className="py-16">
        <Prose>
          <p className="text-sm text-subtle">Last updated: 16 October 2026.</p>
          <h2>A prototype</h2>
          <p>Witnessmark is an early-stage prototype offered free of charge for evaluation. Features, methods and thresholds may change, and the service may be unavailable at times.</p>
          <h2>Decision support only</h2>
          <p>{DISCLAIMER} Findings and route checks describe what the available data is consistent with, at the confidence stated. They are not a guarantee that a flight is safe, or proof of what caused an incident. The operator and remote pilot remain responsible for every flight and for meeting CAA requirements.</p>
          <h2>Your uploads</h2>
          <p>Only upload flight logs you are entitled to share. Don't upload logs that must stay confidential: cases can currently be opened by anyone who has the link. You keep ownership of your data; you allow us to process it to produce your case and, in anonymised and aggregated form, to improve the method.</p>
          <h2>Acceptable use</h2>
          <p>Don't try to break, overload or misuse the service, and don't use it to locate or target anyone. This service is receive-only; we never transmit or jam signals.</p>
          <h2>Liability</h2>
          <p>To the extent the law allows, the prototype is provided "as is" without warranties, and we aren't liable for decisions made using it. Nothing in these terms limits liability that cannot be limited by law.</p>
          <h2>Contact</h2>
          <p>Questions about these terms: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. These terms are governed by the law of England and Wales.</p>
        </Prose>
      </Container>
    </Page>
  );
}
