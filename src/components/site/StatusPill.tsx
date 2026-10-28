import { CheckCircle2, AlertTriangle, XOctagon, CircleDashed } from "lucide-react";
import { cn } from "@/lib/utils";

export type Status = "go" | "caution" | "nogo" | "nodata";

const map = {
  go: { label: "GO", Icon: CheckCircle2, cls: "text-good border-good/40 bg-good/10" },
  caution: { label: "CAUTION", Icon: AlertTriangle, cls: "text-warn border-warn/40 bg-warn/10" },
  nogo: { label: "NO-GO", Icon: XOctagon, cls: "text-bad border-bad/40 bg-bad/10" },
  nodata: { label: "NO DATA", Icon: CircleDashed, cls: "text-na border-na/40 bg-na/10" },
} as const;

export function StatusPill({ status, className }: { status: Status; className?: string }) {
  const { label, Icon, cls } = map[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-xs font-medium", cls, className)}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}
