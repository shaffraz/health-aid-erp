import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type MetricCardProps = {
  label: string;
  value: string;
  helper?: string;
  icon: LucideIcon;
  tone?: "care" | "lagoon" | "ink" | "amber";
};

const tones = {
  care: "bg-care-50 text-care-700",
  lagoon: "bg-lagoon-50 text-lagoon-700",
  ink: "bg-slate-100 text-ink",
  amber: "bg-amber-50 text-amber-700"
};

export function MetricCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = "lagoon"
}: MetricCardProps) {
  return (
    <div className="panel p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-ink">{value}</p>
        </div>
        <span className={cn("rounded-lg p-2.5", tones[tone])}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      {helper ? <p className="mt-3 text-sm text-slate-500">{helper}</p> : null}
    </div>
  );
}
