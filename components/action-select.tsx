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
  buttonLabel = "Go",
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
        "flex w-full min-w-[176px] max-w-[210px] items-center justify-end gap-1.5 rounded-lg bg-[#efefef] p-1",
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
        className="focus-ring min-h-10 min-w-0 flex-1 rounded-lg border border-[#d9d9d9] bg-white px-2.5 py-2 text-xs font-semibold text-[#46484a]"
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
        className={buttonClass(canApply ? "primary" : "muted", "min-h-10 px-3 py-2 text-xs shadow-none")}
      >
        {buttonLabel}
      </button>
    </div>
  );
}
