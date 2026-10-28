import { CONTACT_EMAIL } from "@/lib/site";

/** Public pages listed in the sitemap. Case files, admin and redirects are left out on purpose. */
export const SITEMAP_PATHS = [
  "/", "/product", "/pre-flight", "/pre-flight/check", "/evidence", "/demo", "/method", "/trust", "/about", "/privacy", "/terms",
] as const;

/** Small text files served by the server entry: robots.txt, sitemap.xml and security.txt. */
export function wellKnownResponse(url: URL): Response | null {
  const origin = url.origin;
  const text = (body: string, type: string) =>
    new Response(body, { headers: { "content-type": `${type}; charset=utf-8`, "cache-control": "public, max-age=3600" } });

  switch (url.pathname) {
    case "/robots.txt":
      return text(["User-agent: *", "Allow: /", "Disallow: /analysis/", "Disallow: /admin/", "", `Sitemap: ${origin}/sitemap.xml`, ""].join("\n"), "text/plain");
    case "/sitemap.xml":
      return text(
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${SITEMAP_PATHS.map((p) => `  <url><loc>${origin}${p === "/" ? "/" : p}</loc></url>`).join("\n")}\n</urlset>\n`,
        "application/xml",
      );
    case "/.well-known/security.txt":
    case "/security.txt":
      return text(
        [
          `Contact: mailto:${CONTACT_EMAIL}`,
          "Expires: 2027-10-16T00:00:00.000Z",
          "Preferred-Languages: en",
          `Canonical: ${origin}/.well-known/security.txt`,
          `Policy: ${origin}/trust#security`,
          "",
          "# Please report vulnerabilities privately by email. We aim to reply within 5 working days.",
          "# Testing must not affect other users' data or the service's availability. No denial-of-service,",
          "# social engineering or automated scanning at volume, please.",
          "",
        ].join("\n"),
        "text/plain",
      );
    default:
      return null;
  }
}
