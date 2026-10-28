import { createFileRoute, Link } from "@tanstack/react-router";
import { Page } from "@/components/wm/Page";
import { Container, PageIntro, Prose } from "@/components/wm/ui";
import { CONTACT_EMAIL } from "@/lib/site";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/trust")({
  head: () => ({ meta: seo({ title: "Trust & data handling", description: "How Witnessmark handles flight logs, fingerprints files, records an audit trail and states its limits. Honest about being an early-stage prototype." }) }),
  component: Trust,
});

function Trust() {
  return (
    <Page>
      <PageIntro eyebrow="Trust & data handling" title="What we promise, and what we don't yet." lead="Witnessmark is an early-stage prototype. This page sets out plainly how data is handled today and what will change before production use." />
      <Container narrow className="py-16">
        <Prose>
          <h2>Our commitments</h2>
          <ul>
            <li><strong>Neutral.</strong> The same method runs whoever uploads the log, insurer or operator.</li>
            <li><strong>Published.</strong> Every rule, threshold and data source is on the <Link to="/method">method page</Link>, versioned with a changelog.</li>
            <li><strong>Honest about uncertainty.</strong> Every result carries a confidence level and its limitations. Thin data is never presented as certainty.</li>
            <li><strong>Labelled.</strong> Simulated and demo data is marked wherever it appears, including in exported reports.</li>
          </ul>

          <h2>Tamper evidence</h2>
          <p>When a flight log is uploaded, our server computes a SHA-256 fingerprint from the exact bytes it received and stores it with the case. The browser never supplies the fingerprint, so it can't be forged. Anyone holding a copy of the file can check it against the case: a single changed value produces a completely different fingerprint. The fingerprint shows the file hasn't changed since upload; it can't show the log was accurate when it was recorded. Excel files are read into rows in your browser before upload; the fingerprint is always of the original file you chose.</p>
          <p>Each case also keeps an audit trail in which every entry's hash covers the one before it, so editing a past entry breaks the chain visibly. In this prototype, sign-offs and the audit trail are stored in the reviewer's browser; a shared, server-side record is planned with accounts.</p>

          <h2 id="security">Security measures</h2>
          <ul>
            <li><strong>Encrypted connections only</strong>, with HTTP Strict Transport Security.</li>
            <li><strong>Protective browser headers</strong> on every page: no MIME sniffing, a strict referrer policy, camera, microphone and location access switched off, and framing limited to our own site and editor.</li>
            <li><strong>Every upload is re-checked on the server</strong>: size-limited, re-parsed and validated before anything is stored; file names are cleaned of hidden characters.</li>
            <li><strong>Cases are read through our server</strong>, not straight from the database, and only demo cases are listed publicly.</li>
            <li><strong>The AI narrative only works on stored cases.</strong> The evidence is rebuilt on the server, so the endpoint can't be used to send arbitrary text to an AI model.</li>
            <li><strong>Rate limits</strong> on uploads, case lookups and narrative drafting slow down scripted abuse.</li>
            <li><strong>Cross-site request protection</strong> on every server action.</li>
            <li><strong>No secrets in the browser.</strong> Database admin and AI keys stay on the server.</li>
            <li><strong>Data imports are locked.</strong> Only an operator holding a long secret token can add aircraft data; the token is checked in constant time, attempts are rate limited, and the import is switched off entirely when no token is configured.</li>
            <li><strong>Dependencies checked</strong> for known vulnerabilities (none found at our last audit, October 2026).</li>
          </ul>
          <p>This is still a prototype, not a certified system: there are no user accounts or formal security certifications yet. Please report anything that looks wrong to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>; our <a href="/.well-known/security.txt">security.txt</a> sets out how. We ask that testing never touches other people's data or the service's availability.</p>

          <h2>What we store</h2>
          <p>For each uploaded log: the GPS readings (time, position, altitude, accuracy, satellite count and receiver flags), the file name, the upload time and the fingerprint. We don't ask for personal details; please keep them out of file names. Route checks run in your browser and are not stored by us.</p>

          <h2>Who can see a case</h2>
          <p>Today, a case can be opened by anyone who has its link, which contains a long random identifier. Uploaded cases are not listed publicly: the site only lists demo cases plus the uploads made from your own browser. Even so, this is not yet a confidential system, so <strong>please don't upload logs that must stay private</strong>. Private workspaces with sign-in and access control will come before any production use.</p>

          <h2>AI-drafted narratives</h2>
          <p>Findings are produced by fixed, published rules, not by an AI model. If you choose to draft a narrative for a report, a summary of the evidence table (not the raw flight log) is sent to an AI provider to write it, and the result is labelled as machine-drafted. We don't use flight logs to train models.</p>

          <h2>Data licences</h2>
          <p>Aircraft data comes from the Stanford GPS Laboratory under a non-commercial licence (CC BY-NC 4.0). We will hold a commercial licence before charging for the service.</p>

          <h2 id="accessibility">Accessibility</h2>
          <p>We aim to meet WCAG 2.2 AA: readable contrast, visible keyboard focus, no information carried by colour alone (every status has a word), and reduced motion respected. If something doesn't work for you, please tell us.</p>

          <h2>Questions and problems</h2>
          <p>To ask about data handling or to report a security problem, email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
        </Prose>
      </Container>
    </Page>
  );
}
