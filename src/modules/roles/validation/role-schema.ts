import { z } from "zod";

export const roleSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Role name must be at least 2 characters")
    .max(50, "Role name is too long"),
});

export type RoleFormInput = z.infer<typeof roleSchema>;

export const permissionPairSchema = z.object({
  module: z.string().trim().min(1),
  action: z.string().trim().min(1),
});

export const assignPermissionsSchema = z.array(permissionPairSchema);
