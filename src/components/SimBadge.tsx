import { Info } from "lucide-react";

export function SimBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-warn/40 px-2 py-0.5 text-xs font-medium text-warn">
      <Info className="h-3 w-3" /> Demonstration data, not a real incident
    </span>
  );
}
