export function PlaceholderPage({ eyebrow, title, intro }: { eyebrow: string; title: string; intro: string }) {
  return (
    <section className="container-wm pb-16 pt-16 md:pt-24">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="mt-3 max-w-3xl text-4xl md:text-5xl">{title}</h1>
      <p className="mt-5 max-w-2xl text-lg text-muted-foreground">{intro}</p>
      <div className="mt-12 rounded-xl border border-dashed border-border bg-card p-8 text-sm text-subtle">This page is being prepared.</div>
    </section>
  );
}

export function pageHead(title: string, description: string) {
  const full = `${title} — Witnessmark`;
  return {
    meta: [
      { title: full },
      { name: "description", content: description },
      { property: "og:title", content: full },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  };
}
