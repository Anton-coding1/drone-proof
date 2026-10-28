import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { casesListQuery } from "@/lib/cases";
import { myCaseIds } from "@/lib/browserStore";
import { FOOTER, FEATURES_NAV } from "@/lib/nav";
import { Upload, FileText, Route as RouteIcon, ArrowRight } from "lucide-react";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data: list } = useQuery({ ...casesListQuery(open ? myCaseIds() : []), enabled: open });
  const data = list ? [...list.own, ...list.demos] : [];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); } };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("wm-open-palette", onOpen);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("wm-open-palette", onOpen); };
  }, []);
  const go = (to: string, hash?: string) => { setOpen(false); navigate({ to, ...(hash ? { hash } : {}) }); };
  const pages = FOOTER.flatMap((g) => g.links).filter((l, i, a) => a.findIndex((x) => x.label === l.label) === i);
  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Jump to a case or page…" />
      <CommandList>
        <CommandEmpty>Nothing matches.</CommandEmpty>
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => go("/evidence", "upload")}><Upload className="h-4 w-4" /> Analyse a flight log</CommandItem>
          <CommandItem onSelect={() => go("/pre-flight/check")}><RouteIcon className="h-4 w-4" /> Check a route</CommandItem>
        </CommandGroup>
        {!!data?.length && (
          <CommandGroup heading="Cases">
            {data.map((c) => (
              <CommandItem key={c.id} value={`${c.name} ${c.location_name ?? ""} ${c.id}`} onSelect={() => { setOpen(false); navigate({ to: "/analysis/$scenarioId", params: { scenarioId: c.id } }); }}>
                <FileText className="h-4 w-4" /> {c.name}{c.is_simulated && <span className="ml-auto font-mono text-[10px] text-muted-foreground">Demo</span>}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        <CommandGroup heading="Pages">
          {FEATURES_NAV.map((p) => <CommandItem key={p.label} onSelect={() => go(p.to, p.hash)}><p.icon className="h-4 w-4" /> {p.label}</CommandItem>)}
          {pages.map((l) => <CommandItem key={l.label} onSelect={() => go(l.to, l.hash)}><ArrowRight className="h-4 w-4" /> {l.label}</CommandItem>)}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
