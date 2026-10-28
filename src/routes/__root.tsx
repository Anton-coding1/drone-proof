import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { CommandPalette } from "@/components/CommandPalette";
import { Wordmark, btn } from "@/components/wm/ui";
import { seo } from "@/lib/seo";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <Link to="/" aria-label="Witnessmark home"><Wordmark className="text-lg" /></Link>
      <p className="eyebrow mt-12">Error 404</p>
      <h1 className="mt-3 text-[34px] leading-[40px] sm:text-[44px] sm:leading-[52px]">This page isn't on the map.</h1>
      <p className="mt-4 max-w-md text-muted-foreground">The link may be old, or the page may have moved. These will get you back on course:</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to="/" className={btn.primary}>Home</Link>
        <Link to="/evidence" className={btn.secondary}>Incident evidence</Link>
        <Link to="/pre-flight" className={btn.secondary}>Pre-flight check</Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <Wordmark className="text-lg" />
      <p className="eyebrow mt-12">Something went wrong</p>
      <h1 className="mt-3 text-[30px] leading-[38px]">This page didn't load.</h1>
      <p className="mt-4 max-w-md text-muted-foreground">It's a problem on our side, not yours. Try again, or head back home.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => { router.invalidate(); reset(); }}
          className={btn.primary}
        >
          Try again
        </button>
        <a href="/" className={btn.secondary}>Go home</a>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#08090A" },
      { name: "color-scheme", content: "dark" },
      ...seo({ title: "Witnessmark", description: "Independent intelligence on GPS jamming and spoofing for drones: a GO / CAUTION / NO-GO check before a drone flies, and tamper-evident evidence after an incident." }),
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Geist:wght@300..600&family=Geist+Mono:wght@400;500&display=swap" },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Witnessmark",
          description: "Independent intelligence on GPS jamming and spoofing for drones: route checks before a flight and evidence after an incident.",
          areaServed: "GB",
          knowsAbout: ["GNSS interference", "GPS jamming", "GPS spoofing", "Drone operations", "Insurance claims evidence"],
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <CommandPalette />
    </QueryClientProvider>
  );
}
