import { NextRequest, NextResponse } from "next/server";

const deferredPilotRoutes = ["/billing", "/team", "/reports"];
const demoRoutes = ["/dashboard", "/cases", "/share"];

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const demoEnabled = process.env.ENABLE_DEMO_SURFACES === "true";
  if (
    deferredPilotRoutes.some((route) => path === route || path.startsWith(`${route}/`)) ||
    (!demoEnabled && demoRoutes.some((route) => path === route || path.startsWith(`${route}/`)))
  ) {
    return NextResponse.redirect(new URL("/overview", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/billing/:path*", "/team/:path*", "/reports/:path*", "/dashboard/:path*", "/cases/:path*", "/share/:path*"],
};
