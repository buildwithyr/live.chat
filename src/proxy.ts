import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Alle Pfade ausser:
     * - _next/static, _next/image
     * - favicon, manifest, service worker, icons
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icon.svg|.*\\.(?:png|jpg|jpeg|gif|svg|webp)$).*)",
  ],
};
