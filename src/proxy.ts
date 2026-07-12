import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { COOKIE_KEYS } from "@/constants/cookie-keys";
import { getSessionWithUser, renewSession } from "@/lib/session";

const PUBLIC_ROUTES = new Set(["/login"]);

function clearStaleAuthCookies(response: NextResponse): NextResponse {
  // Company/Financial Year selection is only meaningful alongside a valid
  // session — without this, a stale active_company_id cookie left over from
  // an expired session would still be present when RootLayout renders
  // /login, and getCurrentCompany() -> companyService.getCompany() ->
  // getCurrentUser() would throw AuthenticationError instead of the layout
  // rendering cleanly.
  response.cookies.delete(COOKIE_KEYS.SESSION_TOKEN);
  response.cookies.delete(COOKIE_KEYS.ACTIVE_COMPANY_ID);
  response.cookies.delete(COOKIE_KEYS.ACTIVE_FINANCIAL_YEAR_ID);
  return response;
}

// Next.js 16 renamed the `middleware` file convention to `proxy` — this file
// replaces what 07-authentication.md calls `middleware.ts`. Proxy defaults to
// the Node.js runtime, so a direct Prisma session lookup is safe here (unlike
// the Edge-runtime-constrained "optimistic cookie-only check" the Next.js
// auth guide recommends for public multi-region deployments) — this app is a
// local desktop ERP talking to a local Postgres instance, so per-request DB
// latency is negligible and a real validity check is worth the simplicity.
export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(COOKIE_KEYS.SESSION_TOKEN)?.value;
  const session = token ? await getSessionWithUser(token) : null;
  const isPublicRoute = PUBLIC_ROUTES.has(pathname);

  if (!session) {
    const response = isPublicRoute
      ? NextResponse.next()
      : NextResponse.redirect(new URL("/login", request.url));
    return clearStaleAuthCookies(response);
  }

  if (isPublicRoute) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const expiresAt = await renewSession(session.session.id, session.session.rememberMe);
  if (!expiresAt) {
    // Session was concurrently deleted (e.g. logged out from another tab)
    // between the read above and this renewal — treat it as unauthenticated.
    return clearStaleAuthCookies(NextResponse.redirect(new URL("/login", request.url)));
  }

  const response = NextResponse.next();
  response.cookies.set(COOKIE_KEYS.SESSION_TOKEN, session.session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|uploads/).*)"],
};
