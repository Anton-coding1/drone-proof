import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ChevronDown, Menu, Search, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";
import { Photo, PhotoCredit } from "./Photo";
import { allPages, navGroups, type NavGroup } from "./nav";

/** Paths whose top section is a full-bleed photo: header starts transparent there. */
const PHOTO_HEADER_PATHS = ["/"];

type MenuId = NavGroup["id"] | null;

export function Header() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState<MenuId>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const closeTimer = useRef<number | undefined>(undefined);
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(null);
    setMobileOpen(false);
  }, [pathname]);

  const close = useCallback((returnFocus: boolean) => {
    setOpen((cur) => {
      if (returnFocus && cur) triggerRefs.current[cur]?.focus();
      return null;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      } else if (e.key === "Escape") {
        close(true);
        setMobileOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
  }, [mobileOpen]);

  const hoverOpen = (id: MenuId) => {
    window.clearTimeout(closeTimer.current);
    setOpen(id);
  };
  const hoverClose = () => {
    closeTimer.current = window.setTimeout(() => setOpen(null), 150);
  };

  const transparent = PHOTO_HEADER_PATHS.includes(pathname) && !scrolled && !open && !mobileOpen;
  const group = navGroups.find((g) => g.id === open);

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">
        Skip to content
      </a>

      {open && <div aria-hidden="true" onClick={() => close(false)} className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm animate-in fade-in" />}

      <header
        className={cn(
          "sticky top-0 z-50 h-16 border-b transition-colors duration-300",
          transparent ? "border-transparent bg-transparent" : "border-border bg-background/85 backdrop-blur-xl",
        )}
        style={transparent ? { marginBottom: "-4rem" } : { marginBottom: "-4rem" }}
        onMouseLeave={hoverClose}
      >
        <div className="container-wm flex h-16 items-center gap-6">
          <Link to="/" aria-label="Witnessmark home" className="shrink-0 rounded-md">
            <Logo />
          </Link>

          <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
            {navGroups.map((g) => (
              <button
                key={g.id}
                ref={(el) => {
                  triggerRefs.current[g.id] = el;
                }}
                type="button"
                aria-expanded={open === g.id}
                aria-controls={`mega-${g.id}`}
                onMouseEnter={() => hoverOpen(g.id)}
                onClick={() => setOpen(open === g.id ? null : g.id)}
                className={cn(
                  "inline-flex min-h-11 items-center gap-1 rounded-lg px-3 text-sm transition-colors",
                  open === g.id ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {g.label}
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open === g.id && "rotate-180")} aria-hidden="true" />
              </button>
            ))}
            <Link to="/method" onMouseEnter={() => hoverOpen(null)} className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm text-muted-foreground hover:text-foreground" activeProps={{ className: "text-foreground" }}>
              Method
            </Link>
            <Link to="/about" onMouseEnter={() => hoverOpen(null)} className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm text-muted-foreground hover:text-foreground" activeProps={{ className: "text-foreground" }}>
              About
            </Link>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label="Search pages"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm text-muted-foreground hover:text-foreground"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              <kbd className="hidden font-mono text-[11px] text-subtle sm:inline">⌘K</kbd>
            </button>
            <Button asChild className="hidden sm:inline-flex">
              <Link to="/demo">Try it</Link>
            </Button>
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label={mobileOpen ? "Close menu" : "Open menu"} aria-expanded={mobileOpen} onClick={() => setMobileOpen((v) => !v)}>
              {mobileOpen ? <X /> : <Menu />}
            </Button>
          </div>
        </div>

        {group && (
          <div
            id={`mega-${group.id}`}
            onMouseEnter={() => hoverOpen(group.id)}
            className="absolute inset-x-0 top-16 hidden border-b border-border bg-popover lg:block animate-in fade-in slide-in-from-top-1"
          >
            <div className="container-wm grid grid-cols-[1fr_380px] gap-10 py-8">
              <div>
                <p className="eyebrow mb-4">{group.label}</p>
                <ul className="grid grid-cols-2 gap-1">
                  {group.items.map((item) => (
                    <li key={item.title}>
                      <Link to={item.to} hash={item.hash} className="group flex gap-3 rounded-lg p-3 transition-colors hover:bg-muted">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground group-hover:text-signal">
                          <item.icon className="h-[18px] w-[18px]" aria-hidden="true" />
                        </span>
                        <span>
                          <span className="block text-sm font-medium text-foreground">{item.title}</span>
                          <span className="mt-0.5 block text-[13px] text-muted-foreground">{item.description}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <p className="mt-6 border-t border-border pt-4 text-[13px] text-subtle">{group.footnote}</p>
              </div>
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                <Photo photo={group.card.photo} sizes="380px" className="aspect-[16/9]" />
                <div className="p-5">
                  <p className="text-base font-medium">{group.card.title}</p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{group.card.text}</p>
                  <Link to={group.card.to} className="mt-4 inline-flex items-center gap-1.5 text-sm text-signal hover:underline">
                    {group.card.cta} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                  <PhotoCredit photo={group.card.photo} className="mt-4" />
                </div>
              </div>
            </div>
          </div>
        )}
      </header>
      {/* Spacer so non-photo pages start below the header */}
      {!PHOTO_HEADER_PATHS.includes(pathname) && <div aria-hidden="true" className="h-16" />}

      {mobileOpen && (
        <div className="fixed inset-x-0 bottom-0 top-16 z-50 overflow-y-auto bg-background lg:hidden animate-in fade-in">
          <nav aria-label="Mobile" className="container-wm space-y-8 py-6">
            {navGroups.map((g) => (
              <div key={g.id}>
                <p className="eyebrow mb-2">{g.label}</p>
                <ul>
                  {g.items.map((item) => (
                    <li key={item.title}>
                      <Link to={item.to} hash={item.hash} onClick={() => setMobileOpen(false)} className="flex min-h-12 items-center gap-3 border-b border-border text-[15px]">
                        <item.icon className="h-4 w-4 text-subtle" aria-hidden="true" />
                        {item.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div>
              <p className="eyebrow mb-2">Company</p>
              <Link to="/method" className="flex min-h-12 items-center border-b border-border text-[15px]">Method</Link>
              <Link to="/about" className="flex min-h-12 items-center border-b border-border text-[15px]">About</Link>
            </div>
            <Button asChild className="w-full">
              <Link to="/demo">Try it</Link>
            </Button>
          </nav>
        </div>
      )}

      <CommandDialog open={paletteOpen} onOpenChange={setPaletteOpen}>
        <CommandInput placeholder="Go to a page…" />
        <CommandList>
          <CommandEmpty>No pages found.</CommandEmpty>
          <CommandGroup heading="Pages">
            {allPages.map((p) => (
              <CommandItem
                key={p.title}
                value={p.title}
                onSelect={() => {
                  setPaletteOpen(false);
                  navigate({ to: p.to, hash: p.hash });
                }}
              >
                {p.title}
                <span className="ml-auto font-mono text-xs text-subtle">{p.to}{p.hash ? `#${p.hash}` : ""}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
