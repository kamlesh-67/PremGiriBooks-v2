"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { Role } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { RoleSelect } from "@/modules/users/components/role-select";
import {
  createUserSchema,
  updateUserSchema,
  type UserFormInput,
} from "@/modules/users/validation/user-schema";
import type { ActionResult } from "@/types/api";
import type { UserWithRole } from "@/types/user";

interface UserFormProps {
  mode: "create" | "edit";
  roles: Role[];
  defaultValues?: Partial<UserFormInput>;
  onSubmit: (data: UserFormInput) => Promise<ActionResult<UserWithRole>>;
  submitLabel: string;
}

const BASE_DEFAULT_VALUES: UserFormInput = {
  username: "",
  fullName: "",
  email: "",
  mobile: "",
  password: "",
  roleId: "",
};

export function UserForm({ mode, roles, defaultValues, onSubmit, submitLabel }: UserFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<UserFormInput>({
    resolver: zodResolver(mode === "create" ? createUserSchema : updateUserSchema),
    defaultValues: { ...BASE_DEFAULT_VALUES, ...defaultValues },
  });

  async function handleSubmit(data: UserFormInput) {
    setIsSubmitting(true);
    const result = await onSubmit(data);
    setIsSubmitting(false);

    if (result.success) {
      toast.success("User saved successfully.");
      router.push("/settings/users");
      router.refresh();
      return;
    }

    toast.error(result.error ?? "Failed to save user.");
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username *</FormLabel>
                <FormControl>
                  <Input {...field} autoComplete="username" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name *</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email *</FormLabel>
                <FormControl>
                  <Input {...field} type="email" autoComplete="email" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="mobile"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mobile</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} autoComplete="tel" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{mode === "create" ? "Password *" : "Reset Password"}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="password"
                    autoComplete="new-password"
                    placeholder={
                      mode === "edit" ? "Leave blank to keep the current password" : undefined
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="roleId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Role *</FormLabel>
                <FormControl>
                  <RoleSelect roles={roles} value={field.value} onChange={field.onChange} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/settings/users")}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
