import { useEffect, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowRight, ChevronDown, Menu as MenuIcon, Search, X } from "lucide-react";
import { MENUS, NAV_LINKS, type Menu } from "@/lib/nav";
import { Wordmark, btn } from "@/components/wm/ui";
import { Photo, PhotoCredit } from "@/components/wm/Photo";

/** Sticky site header with photo mega-menus. `overlay` = transparent over a hero until the page scrolls. */
export function SiteHeader({ overlay = false }: { overlay?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const headerRef = useRef<HTMLElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => { setMobileOpen(false); setOpenMenu(null); }, [pathname]);

  useEffect(() => {
    if (!openMenu) return;
    const onDoc = (e: MouseEvent) => { if (!headerRef.current?.contains(e.target as Node)) setOpenMenu(null); };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const trigger = headerRef.current?.querySelector<HTMLButtonElement>(`[data-menu="${openMenu}"]`);
      setOpenMenu(null);
      trigger?.focus();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [openMenu]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const cancelClose = () => { if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; } };
  const scheduleClose = () => { cancelClose(); closeTimer.current = setTimeout(() => setOpenMenu(null), 160); };
  useEffect(() => cancelClose, []);

  const solid = !overlay || scrolled || mobileOpen || !!openMenu;
  const active = (to: string) => pathname === to || pathname.startsWith(to + "/");
  const menuActive = (m: Menu) => m.items.some((i) => active(i.to));
  const current = MENUS.find((m) => m.label === openMenu);

  return (
    <>
      <a href="#main" className="sr-only z-[60] rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-3">
        Skip to content
      </a>
      <header
        ref={headerRef}
        onMouseLeave={scheduleClose}
        onMouseEnter={cancelClose}
        className={`sticky top-0 z-50 transition-colors duration-200 ${overlay ? "-mb-16" : ""} ${
          solid ? "border-b bg-background/95 backdrop-blur-md" : "border-b border-transparent bg-transparent"
        }`}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-6 sm:px-8">
          <Link to="/" className="shrink-0 text-[17px]" aria-label="Witnessmark home">
            <Wordmark />
          </Link>

          <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Main">
            {MENUS.map((m) => {
              const isOpen = openMenu === m.label;
              return (
                <button
                  key={m.label}
                  type="button"
                  data-menu={m.label}
                  aria-expanded={isOpen}
                  aria-controls="wm-mega"
                  onClick={() => setOpenMenu(isOpen ? null : m.label)}
                  onMouseEnter={() => { cancelClose(); setOpenMenu(m.label); }}
                  className={`flex h-10 items-center gap-1 rounded-md px-3 text-sm transition-colors hover:text-foreground ${
                    isOpen || menuActive(m) ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {m.label}
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                </button>
              );
            })}
            {NAV_LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onMouseEnter={scheduleClose}
                className={`flex h-10 items-center rounded-md px-3 text-sm transition-colors hover:text-foreground ${active(l.to) ? "text-foreground" : "text-muted-foreground"}`}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event("wm-open-palette"))}
              className="hidden h-10 items-center gap-2 rounded-md px-2.5 text-sm text-muted-foreground hover:text-foreground sm:flex"
              aria-label="Search the site (Ctrl+K)"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              <kbd className="hidden rounded border px-1.5 font-mono text-[10px] text-subtle md:inline">⌘K</kbd>
            </button>
            <Link to="/demo" className={`${btn.primary} !min-h-10 !px-4`}>Try it</Link>
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-md text-foreground lg:hidden"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              aria-controls="mobile-menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {current && (
          <div id="wm-mega" className="absolute inset-x-0 top-full hidden border-b bg-background shadow-2xl shadow-black/50 lg:block animate-in fade-in-0 slide-in-from-top-1 duration-200">
            <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_380px] gap-10 px-8 py-9">
              <div className="flex flex-col">
                <p className="eyebrow">{current.label}</p>
                <ul className="mt-5 grid grid-cols-2 gap-x-6 gap-y-1">
                  {current.items.map((i) => (
                    <li key={i.label}>
                      <Link
                        to={i.to}
                        {...(i.hash ? { hash: i.hash } : {})}
                        onClick={() => setOpenMenu(null)}
                        className="group flex items-start gap-4 rounded-xl p-3 -ml-3 transition-colors hover:bg-foreground/[0.04]"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-card text-foreground/80 transition-colors group-hover:border-signal/50 group-hover:text-signal">
                          <i.icon className="h-[18px] w-[18px]" strokeWidth={1.6} aria-hidden="true" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[15px] font-medium text-foreground">{i.label}</span>
                          <span className="mt-1 block text-[13px] leading-5 text-muted-foreground">{i.desc}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <p className="mt-auto border-t pt-4 text-[13px] text-subtle">{current.footnote}</p>
              </div>
              <div className="group relative overflow-hidden rounded-2xl border bg-card">
                <div className="relative aspect-[16/9] overflow-hidden bg-muted">
                  <Photo photo={current.feature.photo} sizes="380px" className="absolute inset-0 h-full w-full transition-transform duration-500 group-hover:scale-[1.03]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" aria-hidden="true" />
                </div>
                <div className="p-5">
                  <p className="text-[15px] font-medium text-foreground">{current.feature.title}</p>
                  <p className="mt-1.5 text-[13px] leading-5 text-muted-foreground">{current.feature.text}</p>
                  <Link
                    to={current.feature.link.to}
                    {...(current.feature.link.hash ? { hash: current.feature.link.hash } : {})}
                    onClick={() => setOpenMenu(null)}
                    className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-foreground after:absolute after:inset-0 after:content-['']"
                  >
                    {current.feature.link.label} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </Link>
                </div>
                <PhotoCredit photo={current.feature.photo} className="absolute right-3 top-2 z-10" />
              </div>
            </div>
          </div>
        )}
      </header>

      {current && <div className="fixed inset-0 z-40 hidden bg-black/50 backdrop-blur-[2px] lg:block animate-in fade-in-0 duration-200" aria-hidden="true" onMouseEnter={scheduleClose} onClick={() => setOpenMenu(null)} />}

      {mobileOpen && (
        <div id="mobile-menu" className="fixed inset-x-0 bottom-0 top-16 z-40 flex flex-col overflow-y-auto bg-background lg:hidden">
          <nav className="flex-1 px-6 py-6" aria-label="Mobile">
            {MENUS.map((m) => (
              <div key={m.label} className="mb-8">
                <p className="eyebrow">{m.label}</p>
                <ul className="mt-2">
                  {m.items.map((i) => (
                    <li key={i.label}>
                      <Link to={i.to} {...(i.hash ? { hash: i.hash } : {})} onClick={() => setMobileOpen(false)} className="flex min-h-14 items-start gap-3 border-b py-3">
                        <i.icon className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
                        <span className="min-w-0">
                          <span className="block text-[17px]">{i.label}</span>
                          <span className="block text-sm text-muted-foreground">{i.desc}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <ul>
              {NAV_LINKS.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="flex min-h-14 items-center border-b text-[17px]">{l.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      )}
    </>
  );
}
