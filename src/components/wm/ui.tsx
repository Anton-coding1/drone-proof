import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Photo, PhotoCredit } from "@/components/wm/Photo";
import type { Photo as PhotoT } from "@/lib/photos";
import { Check, Copy, Info, TriangleAlert, OctagonX, CircleCheck, CircleDashed, ArrowRight } from "lucide-react";

/** Witnessmark mark: a survey trig triangle with a centre point. */
export function LogoMark({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="M12 3.5 20.5 19H3.5L12 3.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="12" cy="13.6" r="2" fill="currentColor" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-medium tracking-tight text-foreground ${className}`}>
      <LogoMark className="h-[18px] w-[18px] text-primary" />
      Witnessmark
    </span>
  );
}

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`eyebrow ${className}`}>{children}</p>;
}

export function Container({ children, className = "", narrow = false }: { children: ReactNode; className?: string; narrow?: boolean }) {
  return <div className={`mx-auto w-full px-6 sm:px-8 ${narrow ? "max-w-3xl" : "max-w-6xl"} ${className}`}>{children}</div>;
}

export function PageIntro({ eyebrow, title, lead, children, photo }: { eyebrow?: string; title: ReactNode; lead?: ReactNode; children?: ReactNode; photo?: PhotoT }) {
  if (photo) {
    return (
      <header className="relative flex min-h-[78svh] items-end overflow-hidden border-b">
        <Photo photo={photo} className="absolute inset-0 h-full w-full" priority sizes="100vw" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,9,10,0.55)_0%,rgba(8,9,10,0.25)_40%,rgba(8,9,10,0.92)_100%)]" aria-hidden="true" />
        <Container className="relative pb-16 pt-40 sm:pb-20">
          {eyebrow && <p className="text-sm text-white/65">{eyebrow}</p>}
          <h1 className="mt-4 max-w-3xl text-[38px] leading-[42px] text-white sm:text-[64px] sm:leading-[66px]">{title}</h1>
          {lead && <p className="mt-6 max-w-2xl text-[17px] leading-[27px] text-white/80 sm:text-[19px] sm:leading-[30px]">{lead}</p>}
          {children}
        </Container>
        <PhotoCredit photo={photo} className="absolute bottom-4 right-6 sm:right-8" />
      </header>
    );
  }
  return (
    <header className="border-b pb-14 pt-16 sm:pb-20 sm:pt-24">
      <Container>
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h1 className="mt-4 max-w-3xl text-[34px] leading-[40px] sm:text-[52px] sm:leading-[58px]">{title}</h1>
        {lead && <p className="mt-5 max-w-2xl text-[17px] leading-[27px] text-muted-foreground sm:text-[19px] sm:leading-[30px]">{lead}</p>}
        {children}
      </Container>
    </header>
  );
}

export const btn = {
  primary:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85 disabled:opacity-60",
  secondary:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border-strong/60 px-5 text-sm font-medium text-foreground transition-colors hover:border-foreground/60 hover:bg-foreground/[0.04] disabled:opacity-60",
  text: "inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline-offset-4 hover:underline",
};

export function TextLink({ to, hash, children, className = "" }: { to: string; hash?: string; children: ReactNode; className?: string }) {
  return (
    <Link to={to} {...(hash ? { hash } : {})} className={`${btn.text} ${className}`}>
      {children} <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </Link>
  );
}

export function DemoBanner({ children }: { children?: ReactNode }) {
  return (
    <div role="note" className="flex items-start gap-2 rounded-lg border border-warn/40 bg-warn/[0.06] px-4 py-2.5 text-sm text-warn">
      <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{children ?? "Demo data: simulated flight. Not a real claim or incident."}</span>
    </div>
  );
}

export type Status = "go" | "caution" | "nogo" | "unknown";
const STATUS: Record<Status, { label: string; cls: string; Icon: typeof Check }> = {
  go: { label: "GO", cls: "border-good/40 bg-good/10 text-good", Icon: CircleCheck },
  caution: { label: "CAUTION", cls: "border-warn/40 bg-warn/10 text-warn", Icon: TriangleAlert },
  nogo: { label: "NO-GO", cls: "border-bad/40 bg-bad/10 text-bad", Icon: OctagonX },
  unknown: { label: "NO DATA", cls: "border-na/40 bg-na/10 text-na", Icon: CircleDashed },
};

export function StatusPill({ status, label, size = "md" }: { status: Status; label?: string; size?: "sm" | "md" | "lg" }) {
  const s = STATUS[status];
  const sz = size === "lg" ? "px-3.5 py-1.5 text-base" : size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-mono font-medium tracking-wide ${s.cls} ${sz}`}>
      <s.Icon className={size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5"} aria-hidden="true" />
      {label ?? s.label}
    </span>
  );
}

export function ConfidenceMeter({ level }: { level: "High" | "Medium" | "Low" }) {
  const n = level === "High" ? 3 : level === "Medium" ? 2 : 1;
  return (
    <span className="inline-flex items-center gap-2 text-sm" aria-label={`Confidence: ${level}`}>
      <span className="flex gap-1" aria-hidden="true">
        {[1, 2, 3].map((i) => (
          <span key={i} className={`h-2.5 w-5 rounded-sm ${i <= n ? "bg-foreground" : "bg-foreground/15"}`} />
        ))}
      </span>
      <span className="font-medium">{level} confidence</span>
    </span>
  );
}

export function HashField({ value, label = "SHA-256" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const short = value.length > 20 ? `${value.slice(0, 10)}…${value.slice(-8)}` : value;
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-subtle">{label}</span>
      <code className="min-w-0 truncate font-mono text-[13px] text-foreground" title={value}>{value ? short : "Computing…"}</code>
      {value && (
        <button
          type="button"
          onClick={async () => { try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard unavailable */ } }}
          className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
          aria-label="Copy full fingerprint"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      )}
    </div>
  );
}

export function SectionHeading({ eyebrow, title, lead, id }: { eyebrow?: string; title: ReactNode; lead?: ReactNode; id?: string }) {
  return (
    <div className="max-w-2xl">
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 id={id} className="mt-3 scroll-mt-28 text-[28px] leading-[34px] sm:text-[36px] sm:leading-[44px]">{title}</h2>
      {lead && <p className="mt-4 text-[17px] leading-[28px] text-muted-foreground">{lead}</p>}
    </div>
  );
}

export function Prose({ children }: { children: ReactNode }) {
  return (
    <div className="min-w-0 max-w-[68ch] space-y-4 text-[16px] leading-[27px] text-muted-foreground [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-14 [&_h2]:scroll-mt-28 [&_h2]:text-2xl [&_h2]:text-foreground [&_h3]:mt-8 [&_h3]:text-lg [&_h3]:text-foreground [&_li]:pl-1 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5 [&_strong]:font-medium [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
      {children}
    </div>
  );
}
