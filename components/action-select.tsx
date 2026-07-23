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
  placeholder = "Action"
}: ActionSelectProps) {
  const id = useId();
  const [selectedValue, setSelectedValue] = useState("");

  const selectedAction = actions.find((action) => action.value === selectedValue);

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
        "flex w-full min-w-[132px] max-w-[156px] items-center gap-1 rounded-lg bg-[#efefef] p-1",
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
        className="focus-ring min-h-10 min-w-0 flex-1 rounded-md border border-[#d9d9d9] bg-white px-2 py-2 text-xs font-semibold text-[#46484a]"
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
        disabled={!selectedAction || selectedAction.disabled}
        className="focus-ring min-h-10 rounded-md bg-[#224770] px-2 text-xs font-semibold text-white transition hover:bg-[#0eb6ef] disabled:bg-[#d9d9d9] disabled:text-[#46484a]/55"
      >
        Go
      </button>
    </div>
  );
}
