import { z } from "zod";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_REGEX = /^[6-9]\d{9}$/;
const PASSWORD_COMPLEXITY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).*$/;
const PASSWORD_MIN_LENGTH = 8;

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
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .max(150, "Email is too long")
    .refine((value) => EMAIL_REGEX.test(value), { message: "Enter a valid email address" }),
  mobile: optionalPattern(MOBILE_REGEX, "Enter a valid 10-digit mobile number"),
  password: z
    .string()
    .max(128, "Password is too long")
    .refine((value) => value === "" || value.length >= PASSWORD_MIN_LENGTH, {
      message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
    })
    .refine((value) => value === "" || PASSWORD_COMPLEXITY_REGEX.test(value), {
      message: "Password must include an uppercase letter, a lowercase letter, and a number",
    }),
  roleId: z.string().trim().min(1, "Role is required"),
});

export const createUserSchema = updateUserSchema.refine((data) => data.password.length > 0, {
  message: "Password is required",
  path: ["password"],
});

export type UserFormInput = z.infer<typeof updateUserSchema>;
