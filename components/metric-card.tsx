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
  care: "bg-[#84bc3f] text-white",
  lagoon: "bg-[#0eb6ef] text-white",
  ink: "bg-[#efefef] text-[#224770]",
  amber: "bg-[#efefef] text-[#46484a]"
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
          <p className="text-sm font-medium text-[#46484a]">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-[#224770]">{value}</p>
        </div>
        <span className={cn("rounded-lg p-2.5", tones[tone])}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      {helper ? <p className="mt-3 text-sm text-[#46484a]">{helper}</p> : null}
    </div>
  );
}
