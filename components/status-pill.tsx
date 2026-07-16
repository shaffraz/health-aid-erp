import { cn } from "@/lib/utils";

type StatusPillProps = {
  tone?: "green" | "amber" | "cyan" | "red" | "slate";
  children: React.ReactNode;
};

const tones = {
  green: "bg-[#84bc3f] text-white ring-[#84bc3f]",
  amber: "bg-[#efefef] text-[#46484a] ring-[#d9d9d9]",
  cyan: "bg-[#0eb6ef] text-white ring-[#0eb6ef]",
  red: "bg-[#224770] text-white ring-[#224770]",
  slate: "bg-[#efefef] text-[#46484a] ring-[#d9d9d9]"
};

export function StatusPill({ tone = "slate", children }: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
        tones[tone]
      )}
    >
      {children}
    </span>
  );
}
