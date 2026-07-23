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
    panel: "border-[#224770]/30 bg-white",
    label: "text-[#46484a]",
    value: "text-[#224770]",
    helper: "text-[#46484a]"
  },
  info: {
    panel: "border-[#0eb6ef]/35 bg-white",
    label: "text-[#46484a]",
    value: "text-[#224770]",
    helper: "text-[#46484a]"
  },
  success: {
    panel: "border-[#84bc3f]/45 bg-white",
    label: "text-[#46484a]",
    value: "text-[#224770]",
    helper: "text-[#46484a]"
  },
  warning: {
    panel: "border-[#46484a]/25 bg-white",
    label: "text-[#46484a]",
    value: "text-[#224770]",
    helper: "text-[#46484a]"
  },
  danger: {
    panel: "border-[#224770]/30 bg-[#efefef]/60",
    label: "text-[#46484a]",
    value: "text-[#224770]",
    helper: "text-[#46484a]"
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
        "min-h-28 rounded-lg border p-4 shadow-sm transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md md:p-5",
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
    "focus-ring inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition duration-200 ease-out disabled:cursor-not-allowed",
    variant === "primary" &&
      "bg-[#224770] text-white shadow-sm hover:bg-[#0eb6ef] disabled:bg-[#d9d9d9]",
    variant === "secondary" &&
      "border border-[#dfe4e7] bg-white text-[#46484a] hover:border-[#0eb6ef] hover:text-[#224770] disabled:bg-[#efefef] disabled:text-[#46484a]/55",
    variant === "success" &&
      "bg-[#84bc3f] text-white shadow-sm hover:bg-[#224770] disabled:bg-[#d9d9d9]",
    variant === "danger" &&
      "border border-[#46484a]/25 bg-white text-[#46484a] hover:bg-[#efefef] disabled:border-[#efefef] disabled:bg-[#efefef] disabled:text-[#46484a]/55",
    variant === "muted" &&
      "bg-[#efefef] text-[#46484a] hover:bg-[#d9d9d9] disabled:text-[#46484a]/55",
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
  table: "w-full min-w-[680px] divide-y divide-[#efefef] text-sm",
  head: "bg-[#efefef] text-left text-xs font-semibold uppercase tracking-[0.12em] text-[#46484a]",
  row: "transition duration-150 hover:bg-[#efefef]/45",
  cell: "px-3 py-3 align-top text-[#46484a]",
  strongCell: "px-3 py-3 align-top font-semibold text-[#224770]",
  headerCell: "px-3 py-3 align-top",
  numericHeaderCell: "px-3 py-3 text-right align-top",
  numericCell: "whitespace-nowrap px-3 py-3 text-right align-top font-semibold text-[#224770]",
  actionHeaderCell:
    "w-[156px] bg-[#efefef] px-3 py-3 text-left align-top text-[#46484a]",
  actionCell:
    "w-[156px] bg-[#efefef] px-3 py-2.5 align-middle",
  actions: "flex min-w-max items-center justify-start gap-1.5"
};
