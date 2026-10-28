import { createFileRoute } from "@tanstack/react-router";
import { Page } from "@/components/wm/Page";
import { Container, PageIntro, Prose } from "@/components/wm/ui";
import { CONTACT_EMAIL } from "@/lib/site";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: seo({ title: "Privacy", description: "How Witnessmark handles personal data and flight logs." }) }),
  component: Privacy,
});

function Privacy() {
  return (
    <Page>
      <PageIntro eyebrow="Legal" title="Privacy notice" lead="In short: we collect as little as possible, we don't sell data, and we tell you plainly what happens to flight logs." />
      <Container narrow className="py-16">
        <Prose>
          <p className="text-sm text-subtle">Last updated: 16 October 2026. Witnessmark is an early-stage prototype run by its founders; company details will be added once the company is registered.</p>
          <h2>What we collect</h2>
          <ul>
            <li><strong>Flight logs you upload</strong>: GPS readings, file name, upload time and a SHA-256 fingerprint. Logs can include location data, so please remove personal details from file names.</li>
            <li><strong>Messages you send us</strong>: the contact form prepares an email in your own email app; we receive only what you send.</li>
            <li><strong>Data kept in your browser</strong>: case sign-offs, audit trails and a list of your own uploads are stored in your browser's local storage, not on our servers. You can clear them by clearing site data.</li>
          </ul>
          <p>We don't use advertising or analytics cookies. Map tiles are loaded from OpenStreetMap, photos from Unsplash, fonts from Google Fonts and space-weather forecasts from NOAA; those services receive your IP address when your browser loads them.</p>
          <h2>How we use it</h2>
          <p>Only to produce and show the case or route check you asked for, to reply to you, and to improve the method using anonymised, aggregated results. We don't sell data or use flight logs to train AI models. If you request an AI-drafted narrative, a summary of the evidence (not the raw log) is sent to an AI provider to write it.</p>
          <h2>How long we keep it</h2>
          <p>Uploaded logs are kept while the prototype runs so cases stay reviewable. Email us to have a case deleted and we'll remove it.</p>
          <h2>Your rights</h2>
          <p>Under UK data protection law you can ask for access to, correction of or deletion of personal data we hold about you, and you can complain to the Information Commissioner's Office (ico.org.uk). Contact: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
        </Prose>
      </Container>
    </Page>
  );
}
