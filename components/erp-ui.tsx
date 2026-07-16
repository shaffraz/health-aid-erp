import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type KpiTone = "default" | "primary" | "info" | "success" | "warning" | "danger";

const kpiTones: Record<
  KpiTone,
  {
    panel: string;
    label: string;
    value: string;
    helper: string;
  }
> = {
  default: {
    panel: "border-[#efefef] bg-white",
    label: "text-[#46484a]",
    value: "text-[#224770]",
    helper: "text-[#46484a]"
  },
  primary: {
    panel: "border-[#d7e1ec] bg-white",
    label: "text-[#46484a]",
    value: "text-[#224770]",
    helper: "text-[#46484a]"
  },
  info: {
    panel: "border-[#cceffa] bg-white",
    label: "text-[#46484a]",
    value: "text-[#224770]",
    helper: "text-[#46484a]"
  },
  success: {
    panel: "border-[#dceccc] bg-white",
    label: "text-[#3f6f18]",
    value: "text-[#4f7f22]",
    helper: "text-[#46484a]"
  },
  warning: {
    panel: "border-amber-200 bg-white",
    label: "text-amber-700",
    value: "text-amber-800",
    helper: "text-[#46484a]"
  },
  danger: {
    panel: "border-rose-200 bg-rose-50/60",
    label: "text-rose-700",
    value: "text-rose-700",
    helper: "text-rose-700"
  }
};

type KpiCardProps = {
  label: string;
  value: string;
  helper?: string;
  tone?: KpiTone;
  className?: string;
  children?: ReactNode;
};

export function KpiCard({
  label,
  value,
  helper,
  tone = "default",
  className,
  children
}: KpiCardProps) {
  const styles = kpiTones[tone];

  return (
    <div
      className={cn(
        "min-h-32 rounded-xl border p-5 shadow-sm transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md",
        styles.panel,
        className
      )}
    >
      <div className="flex h-full flex-col justify-between gap-4">
        <div>
          <p className={cn("text-xs font-semibold uppercase tracking-[0.14em]", styles.label)}>
            {label}
          </p>
          <p className={cn("mt-3 text-2xl font-bold tracking-tight", styles.value)}>
            {value}
          </p>
          {helper ? (
            <p className={cn("mt-1 text-sm font-medium", styles.helper)}>{helper}</p>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "success" | "danger" | "muted";

export function buttonClass(variant: ButtonVariant = "secondary", className?: string) {
  return cn(
    "focus-ring inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition duration-200 ease-out disabled:cursor-not-allowed",
    variant === "primary" &&
      "bg-[#224770] text-white shadow-sm hover:bg-[#0eb6ef] disabled:bg-slate-300",
    variant === "secondary" &&
      "border border-[#efefef] bg-white text-[#46484a] shadow-sm hover:-translate-y-0.5 hover:shadow-md disabled:bg-slate-100 disabled:text-slate-400",
    variant === "success" &&
      "bg-[#84bc3f] text-white shadow-sm hover:bg-[#73a832] disabled:bg-slate-300",
    variant === "danger" &&
      "border border-rose-200 bg-white text-rose-600 shadow-sm hover:bg-rose-50 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400",
    variant === "muted" &&
      "bg-[#efefef] text-[#46484a] hover:bg-slate-200 disabled:text-slate-400",
    className
  );
}

export function Button({
  variant = "secondary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

export const tableStyles = {
  wrapper: "w-full overflow-x-auto",
  table: "min-w-full divide-y divide-[#efefef] text-sm",
  head: "bg-[#efefef] text-left text-xs font-semibold uppercase tracking-[0.12em] text-[#46484a]",
  row: "transition duration-150 hover:bg-[#efefef]/45",
  cell: "px-5 py-4 text-[#46484a]",
  strongCell: "px-5 py-4 font-semibold text-[#224770]",
  headerCell: "px-5 py-3",
  numericHeaderCell: "px-5 py-3 text-right",
  numericCell: "whitespace-nowrap px-5 py-4 text-right font-semibold text-[#224770]",
  actionHeaderCell:
    "sticky right-0 z-20 bg-[#e9edf1] px-5 py-3 text-right",
  actionCell:
    "sticky right-0 z-10 bg-[#f7f9fb] px-5 py-4",
  actions: "flex min-w-max items-center justify-end gap-2"
};
