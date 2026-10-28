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
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { LogoMark } from "@/components/site/Logo";
import { Button } from "@/components/ui/button";

function NotFoundComponent() {
  return (
    <section className="container-wm flex min-h-[70vh] flex-col items-start justify-center py-24">
      <LogoMark className="h-10 w-10 text-subtle" />
      <p className="eyebrow mt-6 font-mono">404</p>
      <h1 className="mt-2 text-4xl md:text-5xl">This page isn't on the map.</h1>
      <p className="mt-4 max-w-md text-muted-foreground">The address may be mistyped, or the page has moved.</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild><Link to="/">Back to home</Link></Button>
        <Button asChild variant="secondary"><Link to="/product">See the product</Link></Button>
      </div>
    </section>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <section className="container-wm flex min-h-[70vh] flex-col items-start justify-center py-24">
      <LogoMark className="h-10 w-10 text-bad" />
      <h1 className="mt-6 text-4xl">Signal lost.</h1>
      <p className="mt-4 max-w-md text-muted-foreground">Something went wrong loading this page. Try again, or head back home.</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button onClick={() => { router.invalidate(); reset(); }}>Try again</Button>
        <Button asChild variant="secondary"><a href="/">Back to home</a></Button>
      </div>
    </section>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Witnessmark — An independent record of GPS interference" },
      { name: "description", content: "Street-level record of GPS jamming and spoofing for pre-flight checks, incident evidence and site monitoring." },
      { property: "og:title", content: "Witnessmark" },
      { property: "og:description", content: "Street-level record of GPS jamming and spoofing, turned into decisions." },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Witnessmark" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#08090A" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap" },
      { rel: "preconnect", href: "https://images.unsplash.com" },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en-GB" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        <Header />
        <main id="main" tabIndex={-1} className="outline-none">
          {children}
        </main>
        <Footer />
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
