import { Plus } from "lucide-react";

export function Faq({ items }: { items: string[][] }) {
  return (
    <div className="divide-y border-y">
      {items.map(([q, a]) => (
        <details key={q} className="group py-1">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 text-[17px] [&::-webkit-details-marker]:hidden">
            {q}
            <Plus className="h-4 w-4 shrink-0 text-subtle transition-transform group-open:rotate-45" aria-hidden="true" />
          </summary>
          <p className="pb-5 pr-8 text-muted-foreground">{a}</p>
        </details>
      ))}
    </div>
  );
}
