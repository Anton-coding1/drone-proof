const SITE = "Witnessmark";

/** Standard meta tags for a page. Titles follow "Page — Witnessmark". */
export function seo({ title, description, type = "website", noindex = false }: { title: string; description: string; type?: string; noindex?: boolean }) {
  const full = title === SITE ? `${SITE} — independent GPS interference intelligence` : `${title} — ${SITE}`;
  return [
    { title: full },
    { name: "description", content: description },
    { property: "og:title", content: full },
    { property: "og:description", content: description },
    { property: "og:type", content: type },
    { property: "og:site_name", content: SITE },
    { property: "og:image", content: "/og.png" },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: full },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: "/og.png" },
    ...(noindex ? [{ name: "robots", content: "noindex" }] : []),
  ];
}
