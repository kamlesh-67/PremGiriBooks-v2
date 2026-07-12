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
}

export function RoleSelect({ roles, value, onChange, disabled }: RoleSelectProps) {
  return (
    <Select
      value={value === "" ? null : value}
      onValueChange={(nextValue) => onChange(nextValue ?? "")}
      disabled={disabled}
    >
      <SelectTrigger className="w-full">
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
