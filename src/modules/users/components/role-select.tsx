"use client";

import type { Role } from "@prisma/client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface RoleSelectProps {
  roles: Role[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

export function RoleSelect({
  roles,
  value,
  onChange,
  disabled,
  id,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
}: RoleSelectProps) {
  return (
    <Select
      items={roles.map((role) => ({ value: role.id, label: role.name }))}
      value={value === "" ? null : value}
      onValueChange={(nextValue) => onChange(nextValue ?? "")}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        className="w-full"
      >
        <SelectValue placeholder="Select a role" />
      </SelectTrigger>
      <SelectContent>
        {roles.map((role) => (
          <SelectItem key={role.id} value={role.id}>
            {role.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
