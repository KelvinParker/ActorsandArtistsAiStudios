"use client";

import type { ReactNode } from "react";
import { optionsWithCurrent } from "@/lib/casting-picklists";

type Props = {
  id: string;
  name: string;
  label: ReactNode;
  baseOptions: readonly string[];
  defaultValue?: string | null;
  /** When true, prepend current DB value if missing from base list (legacy rows). */
  includeCurrent?: boolean;
  placeholder?: string;
  selectClass: string;
  labelClass: string;
};

export function CastingPicklistSelect({
  id,
  name,
  label,
  baseOptions,
  defaultValue,
  includeCurrent = true,
  placeholder = "— Select —",
  selectClass,
  labelClass,
}: Props) {
  const raw = defaultValue?.trim() ?? "";
  const opts = includeCurrent
    ? optionsWithCurrent(baseOptions, raw || null)
    : [...baseOptions];

  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <select
        id={id}
        name={name}
        defaultValue={raw}
        className={selectClass}
      >
        <option value="">{placeholder}</option>
        {opts.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Height list is generated; same `includeCurrent` behavior. */
export function CastingHeightSelect({
  id,
  name,
  label,
  heights,
  defaultValue,
  selectClass,
  labelClass,
}: {
  id: string;
  name: string;
  label: ReactNode;
  heights: readonly string[];
  defaultValue?: string | null;
  selectClass: string;
  labelClass: string;
}) {
  return (
    <CastingPicklistSelect
      id={id}
      name={name}
      label={label}
      baseOptions={heights}
      defaultValue={defaultValue}
      selectClass={selectClass}
      labelClass={labelClass}
    />
  );
}
