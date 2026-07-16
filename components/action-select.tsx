"use client";

import { useId, useState } from "react";
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
  className?: string;
  placeholder?: string;
};

export function ActionSelect({
  actions,
  ariaLabel = "Row actions",
  className,
  placeholder = "Select action"
}: ActionSelectProps) {
  const id = useId();
  const [selectedValue, setSelectedValue] = useState("");

  function applyAction(value: string) {
    setSelectedValue(value);
    const selectedAction = actions.find((action) => action.value === value);

    if (!selectedAction || selectedAction.disabled) {
      return;
    }

    selectedAction.onSelect();
    setSelectedValue("");
  }

  return (
    <div
      className={cn(
        "flex w-full min-w-[150px] max-w-[180px] items-center justify-end rounded-lg bg-[#efefef] p-1",
        className
      )}
    >
      <label className="sr-only" htmlFor={id}>
        {ariaLabel}
      </label>
      <select
        id={id}
        value={selectedValue}
        onChange={(event) => applyAction(event.target.value)}
        className="focus-ring min-h-10 w-full rounded-md border border-[#d9d9d9] bg-white px-2.5 py-2 text-xs font-semibold text-[#46484a]"
      >
        <option value="">{placeholder}</option>
        {actions.map((action) => (
          <option key={action.value} value={action.value} disabled={action.disabled}>
            {action.label}
          </option>
        ))}
      </select>
    </div>
  );
}
