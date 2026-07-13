import { z } from "zod";

import {
  PASSWORD_COMPLEXITY_MESSAGE,
  PASSWORD_COMPLEXITY_REGEX,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@/constants/password-policy";

const MOBILE_REGEX = /^[6-9]\d{9}$/;

function optionalPattern(regex: RegExp, message: string) {
  return z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || regex.test(value), { message });
}

// Password is validated as "optional-if-blank" at the object level so this
// single schema shape covers Edit (blank = keep current password). Create
// additionally requires a non-blank password via the .refine() below —
// wrapping in .refine() (not .extend()) keeps the input/output type of
// createUserSchema identical to updateUserSchema's, which is what lets a
// single useForm<UserFormInput>() typed hook serve both modes (see
// company-schema.ts's note on why zodResolver requires input/output types to
// match).
export const updateUserSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(50, "Username is too long"),
  fullName: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters")
    .max(100, "Full name is too long"),
  // .trim()/.min()/.max() must run before .pipe(z.email(...)) — z.email()
  // validates the value handed to it as-is, so chaining .trim() after it
  // (e.g. z.email().trim()) would reject a legitimately valid email that
  // merely has surrounding whitespace, since the format check would run
  // before the trim. Verified directly against this project's installed
  // zod version (4.4.3).
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .max(150, "Email is too long")
    .pipe(z.email("Enter a valid email address")),
  mobile: optionalPattern(MOBILE_REGEX, "Enter a valid 10-digit mobile number"),
  password: z
    .string()
    .max(PASSWORD_MAX_LENGTH, "Password is too long")
    .refine((value) => value === "" || value.length >= PASSWORD_MIN_LENGTH, {
      message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
    })
    .refine((value) => value === "" || PASSWORD_COMPLEXITY_REGEX.test(value), {
      message: PASSWORD_COMPLEXITY_MESSAGE,
    }),
  roleId: z.string().trim().min(1, "Role is required"),
});

export const createUserSchema = updateUserSchema.refine((data) => data.password.length > 0, {
  message: "Password is required",
  path: ["password"],
});

export type UserFormInput = z.infer<typeof updateUserSchema>;
