import type { NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"

// Next.js 16 : "middleware" s'appelle désormais "proxy".
export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icon|apple-icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
