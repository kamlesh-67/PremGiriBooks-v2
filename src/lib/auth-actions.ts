"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { COOKIE_KEYS } from "@/constants/cookie-keys";
import { InvalidCredentialsError, UserDisabledError, login, logout } from "@/lib/auth";
import { clearCurrentCompany } from "@/lib/current-company";
import { clearCurrentFinancialYear } from "@/lib/current-financial-year";
import { loginSchema, type LoginInput } from "@/lib/auth-schema";
import type { ActionResult } from "@/types/api";

function toErrorMessage(error: unknown): string {
  if (error instanceof InvalidCredentialsError || error instanceof UserDisabledError) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

export async function loginAction(input: LoginInput): Promise<ActionResult> {
  let sessionId: string;
  let expiresAt: Date;

  try {
    const data = loginSchema.parse(input);
    const result = await login(data.username, data.password, data.rememberMe ?? false);
    sessionId = result.sessionId;
    expiresAt = result.expiresAt;
  } catch (error) {
    return { success: false, error: toErrorMessage(error) };
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_KEYS.SESSION_TOKEN, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  redirect("/");
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_KEYS.SESSION_TOKEN)?.value;

  if (token) {
    await logout(token);
  }

  cookieStore.delete(COOKIE_KEYS.SESSION_TOKEN);
  await clearCurrentCompany();
  await clearCurrentFinancialYear();

  redirect("/login");
}
