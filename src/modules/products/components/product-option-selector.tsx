"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NONE_VALUE = "__none__";
const EMPTY_VALUE = "__no_options__";

export interface ProductOptionItem {
  id: string;
  label: string;
  isActive: boolean;
}

interface ProductOptionSelectorProps {
  /**
   * The pickable options — active masters of the current company, plus (on
   * edit) the product's current reference even if since deactivated, kept so
   * the stored value stays visible and re-selectable (labeled "(Inactive)"),
   * mirroring branch-selector.tsx.
   */
  options: ProductOptionItem[];
  value: string | undefined;
  onChange: (id: string | undefined) => void;
  /** false for the required Unit picker — hides the "None" item. */
  allowNone?: boolean;
  noneLabel?: string;
  /** Shown as the disabled row when the company has no options yet. */
  emptyLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Forwarded to the trigger so FormControl can wire label/description/error
   * associations (id, aria-describedby, aria-invalid). */
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

function optionLabel(option: ProductOptionItem): string {
  // The only inactive entry that can appear here is an edited product's
  // current, since-deactivated reference — mark it so the state isn't
  // invisible (branch-selector.tsx convention).
  return option.isActive ? option.label : `${option.label} (Inactive)`;
}

/**
 * Shared picker for the Product Form's six master lookups (Category, Brand,
 * Unit, HSN/SAC, GST Rate, Default Warehouse), one generic component instead
 * of six near-identical copies — the same Select recipe as
 * branch-selector.tsx.
 */
export function ProductOptionSelector({
  options,
  value,
  onChange,
  allowNone = true,
  noneLabel = "None",
  emptyLabel = "No options",
  placeholder,
  disabled,
  ...triggerProps
}: ProductOptionSelectorProps) {
  const displayPlaceholder = placeholder ?? (allowNone ? noneLabel : "Select…");

  return (
    <Select
      // Base UI's Select decides controlled-vs-uncontrolled on the first
      // render by checking whether `value` is `undefined` — NONE_VALUE (a
      // distinct, defined "controlled, nothing selected yet" sentinel) keeps
      // it controlled for the component's entire lifetime (see
      // branch-selector.tsx for the reference fix this mirrors).
      value={value ?? NONE_VALUE}
      onValueChange={(next) => onChange(!next || next === NONE_VALUE ? undefined : next)}
      disabled={disabled}
    >
      <SelectTrigger className="w-full" {...triggerProps}>
        <SelectValue placeholder={displayPlaceholder}>
          {(current: string | null) => {
            if (!current || current === NONE_VALUE) {
              return displayPlaceholder;
            }
            const selected = options.find((option) => option.id === current);
            return selected ? optionLabel(selected) : displayPlaceholder;
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {allowNone ? <SelectItem value={NONE_VALUE}>{noneLabel}</SelectItem> : null}
        {options.length === 0 ? (
          <SelectItem value={EMPTY_VALUE} disabled>
            {emptyLabel}
          </SelectItem>
        ) : (
          options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {optionLabel(option)}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
