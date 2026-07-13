"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

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
import {
  createCompanySchema,
  type CreateCompanyInput,
} from "@/modules/administration/validation/create-company-schema";
import { createCompanyAction } from "@/modules/administration/actions/company-admin-actions";

interface FormSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

function FormSection({ title, description, children }: FormSectionProps) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

const DEFAULT_VALUES: CreateCompanyInput = {
  company: {
    companyName: "",
    legalName: "",
    country: "India",
    currency: "INR",
    currencySymbol: "₹",
    decimalPlaces: 2,
  },
  companyAdmin: {
    username: "",
    fullName: "",
    email: "",
    password: "",
  },
  financialYear: {
    name: "",
    startDate: "",
    endDate: "",
  },
};

/**
 * The full spec Company Creation workflow, collected in one Super-Admin-only
 * form: Company legal/business essentials (full registration/address/logo
 * detail is filled in afterward via /administration/companies/[id]/edit,
 * reusing modules/company/components/company-form.tsx's CompanyForm),
 * the first Company Admin's credentials, and the Financial Year — created
 * atomically by companyService.createCompany().
 */
export function CreateCompanyForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<CreateCompanyInput>({
    resolver: zodResolver(createCompanySchema),
    defaultValues: DEFAULT_VALUES,
  });

  async function handleSubmit(data: CreateCompanyInput) {
    setIsSubmitting(true);
    let result: Awaited<ReturnType<typeof createCompanyAction>>;
    try {
      result = await createCompanyAction(data);
    } finally {
      setIsSubmitting(false);
    }

    if (result.success) {
      toast.success("Company created successfully.");
      router.push("/administration/companies");
      router.refresh();
      return;
    }

    toast.error(result.error ?? "Failed to create company.");
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-8">
        <FormSection
          title="Company"
          description="Full legal/registration details can be added afterward from the company's edit page."
        >
          <FormField
            control={form.control}
            name="company.companyName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Company Name *</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="company.legalName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Legal Name *</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </FormSection>

        <FormSection title="Company Admin" description="The first user who can sign in and manage this company.">
          <FormField
            control={form.control}
            name="companyAdmin.username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username *</FormLabel>
                <FormControl>
                  <Input {...field} autoComplete="off" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="companyAdmin.fullName"
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
            name="companyAdmin.email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email *</FormLabel>
                <FormControl>
                  <Input {...field} type="email" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="companyAdmin.mobile"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mobile</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="companyAdmin.password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password *</FormLabel>
                <FormControl>
                  <Input {...field} type="password" autoComplete="new-password" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </FormSection>

        <FormSection title="Financial Year">
          <FormField
            control={form.control}
            name="financialYear.name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name *</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="2026-2027" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="financialYear.startDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Start Date *</FormLabel>
                <FormControl>
                  <Input {...field} type="date" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="financialYear.endDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>End Date *</FormLabel>
                <FormControl>
                  <Input {...field} type="date" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </FormSection>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/administration/companies")}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating…" : "Create Company"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
