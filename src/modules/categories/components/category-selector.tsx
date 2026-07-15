"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Category } from "@/types/category";

const NONE_VALUE = "__none__";

interface CategorySelectorProps {
  /**
   * The pickable categories. The caller owns the exclusion rules — the edit
   * form passes a list that already excludes the category being edited and
   * its descendants (the no-cycle rule the server re-verifies).
   */
  categories: Category[];
  value: string | undefined;
  onChange: (categoryId: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
}

function categoryLabel(category: Category): string {
  // The only inactive entry that can appear here is an edited category's
  // current, since-deactivated parent (kept so the stored value stays
  // visible and re-selectable); mark it so the state isn't invisible.
  return category.isActive ? category.name : `${category.name} (Inactive)`;
}

/**
 * Reusable parent-category picker, mirroring ledger-group-selector.tsx.
 * Flat, alphabetical; the tree page conveys hierarchy, this stays legible
 * as a plain lookup.
 */
export function CategorySelector({
  categories,
  value,
  onChange,
  placeholder = "Select a category",
  disabled,
}: CategorySelectorProps) {
  return (
    <Select
      // Base UI's Select decides controlled-vs-uncontrolled on the first
      // render by checking whether `value` is `undefined` — NONE_VALUE (a
      // distinct, defined "controlled, nothing selected yet" sentinel) keeps
      // it controlled for the component's entire lifetime. See
      // context/current-error/05-role-select-uncontrolled-to-controlled.md
      // for the reference fix this mirrors (via ledger-group-selector.tsx).
      value={value ?? NONE_VALUE}
      onValueChange={(next) => onChange(!next || next === NONE_VALUE ? undefined : next)}
      disabled={disabled}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder}>
          {(current: string | null) => {
            if (!current || current === NONE_VALUE) {
              return "No parent (top-level category)";
            }
            const selected = categories.find((category) => category.id === current);
            return selected ? categoryLabel(selected) : placeholder;
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE_VALUE}>No parent (top-level category)</SelectItem>
        {categories.map((category) => (
          <SelectItem key={category.id} value={category.id}>
            {categoryLabel(category)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
