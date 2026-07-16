"use client";

import { useId, useState } from "react";
import { buttonClass } from "@/components/erp-ui";
import { cn } from "@/lib/utils";

export type ActionSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
  onSelect: () => void;
};

type ActionSelectProps = {
  actions: ActionSelectOption[];
  ariaLabel?: string;
  buttonLabel?: string;
  className?: string;
  placeholder?: string;
};

export function ActionSelect({
  actions,
  ariaLabel = "Row actions",
  buttonLabel = "Apply",
  className,
  placeholder = "Select action"
}: ActionSelectProps) {
  const id = useId();
  const [selectedValue, setSelectedValue] = useState("");
  const selectedAction = actions.find((action) => action.value === selectedValue);
  const canApply = Boolean(selectedAction && !selectedAction.disabled);

  function applyAction() {
    if (!selectedAction || selectedAction.disabled) {
      return;
    }

    selectedAction.onSelect();
    setSelectedValue("");
  }

  return (
    <div
      className={cn(
        "flex min-w-[220px] items-center justify-end gap-2 rounded-lg bg-[#f7f9fb] p-1.5",
        className
      )}
    >
      <label className="sr-only" htmlFor={id}>
        {ariaLabel}
      </label>
      <select
        id={id}
        value={selectedValue}
        onChange={(event) => setSelectedValue(event.target.value)}
        className="focus-ring min-h-10 w-36 rounded-lg border border-[#dbe3ea] bg-white px-3 py-2 text-xs font-semibold text-[#46484a] shadow-sm"
      >
        <option value="">{placeholder}</option>
        {actions.map((action) => (
          <option key={action.value} value={action.value} disabled={action.disabled}>
            {action.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={applyAction}
        disabled={!canApply}
        className={buttonClass(canApply ? "secondary" : "muted", "min-h-10 px-3 py-2 text-xs")}
      >
        {buttonLabel}
      </button>
    </div>
  );
}
