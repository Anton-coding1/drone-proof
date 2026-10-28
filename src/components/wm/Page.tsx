import type { ReactNode } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export function Page({ children, overlay = false }: { children: ReactNode; overlay?: boolean }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader overlay={overlay} />
      <main id="main" tabIndex={-1} className="flex-1 outline-none">{children}</main>
      <SiteFooter />
    </div>
  );
}
