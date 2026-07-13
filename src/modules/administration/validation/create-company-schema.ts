import { z } from "zod";

import {
  PASSWORD_COMPLEXITY_MESSAGE,
  PASSWORD_COMPLEXITY_REGEX,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@/constants/password-policy";
import { companySchema } from "@/modules/company/validation/company-schema";
import { financialYearSchema } from "@/modules/financial-year/validation/financial-year-schema";

const MOBILE_REGEX = /^[6-9]\d{9}$/;

export const companyAdminSchema = z.object({
  username: z.string().trim().min(3, "Username must be at least 3 characters").max(50, "Username is too long"),
  fullName: z.string().trim().min(2, "Full name must be at least 2 characters").max(100, "Full name is too long"),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .max(150, "Email is too long")
    .pipe(z.email("Enter a valid email address")),
  mobile: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || MOBILE_REGEX.test(value), {
      message: "Enter a valid 10-digit mobile number",
    }),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
    .max(PASSWORD_MAX_LENGTH, "Password is too long")
    .refine((value) => PASSWORD_COMPLEXITY_REGEX.test(value), {
      message: PASSWORD_COMPLEXITY_MESSAGE,
    }),
});

/**
 * The full "Create Company" workflow input, per
 * architecture-Migration-Super-Admin-Administration.md's Company Creation
 * section — Company legal/business info, the first Company Admin's
 * credentials, and the Financial Year, all collected in one Super-Admin-
 * only form and created atomically by
 * companyService.createCompany()/tenantBootstrapService.bootstrapTenant().
 */
export const createCompanySchema = z.object({
  company: companySchema,
  companyAdmin: companyAdminSchema,
  financialYear: financialYearSchema,
});

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type CompanyAdminInput = z.infer<typeof companyAdminSchema>;
