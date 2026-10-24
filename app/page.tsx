import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { ACCUEIL_PAR_ROLE } from "@/lib/roles"
import { supabaseConfigure } from "@/lib/supabase/env"

export default async function Accueil() {
  if (!supabaseConfigure) {
    return (
      <main className="mx-auto max-w-xl p-6 space-y-3">
        <h1 className="text-2xl font-semibold">Configuration requise</h1>
        <p className="text-muted-foreground">
          Renseignez <code>NEXT_PUBLIC_SUPABASE_URL</code> et <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>{" "}
          dans <code>.env.local</code> (ou dans les variables d&apos;environnement Vercel), puis relancez
          l&apos;application.
        </p>
      </main>
    )
  }

  const session = await getSession()
  redirect(session ? ACCUEIL_PAR_ROLE[session.profil.role] : "/login")
}
