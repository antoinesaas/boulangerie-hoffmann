import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { ACCUEIL_PAR_ROLE, estRole, rolesAutorises } from "@/lib/roles"
import type { Role } from "@/types"
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, supabaseConfigure } from "./env"

const CHEMINS_PUBLICS = ["/login", "/auth", "/offline"]

function estPublic(chemin: string) {
  return CHEMINS_PUBLICS.some((p) => chemin === p || chemin.startsWith(`${p}/`))
}

/**
 * Rafraîchit la session Supabase (cookies) puis applique le routage par rôle :
 *  - non connecté            -> /login
 *  - connecté sur /login ou / -> page d'accueil de son rôle
 *  - rôle non autorisé        -> page d'accueil de son rôle
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })
  const chemin = request.nextUrl.pathname

  if (!supabaseConfigure) {
    return response
  }

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        Object.entries(headers).forEach(([cle, valeur]) => response.headers.set(cle, valeur))
      },
    },
  })

  // Ne rien intercaler entre la création du client et getClaims() (rafraîchissement du jeton).
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub

  const rediriger = (cible: string) => {
    const url = request.nextUrl.clone()
    url.pathname = cible
    url.search = ""
    const redirection = NextResponse.redirect(url)
    response.cookies.getAll().forEach((c) => redirection.cookies.set(c))
    response.headers.forEach((valeur, cle) => {
      if (cle.toLowerCase() !== "location" && cle.toLowerCase() !== "set-cookie") {
        redirection.headers.set(cle, valeur)
      }
    })
    return redirection
  }

  if (!userId) {
    if (estPublic(chemin)) return response
    return rediriger("/login")
  }

  const autorises = rolesAutorises(chemin)
  if (chemin !== "/" && chemin !== "/login" && !autorises) {
    return response
  }

  const { data: profil } = await supabase
    .from("profils")
    .select("role, actif")
    .eq("id", userId)
    .maybeSingle()

  const role: Role | null = profil?.actif && estRole(profil.role) ? profil.role : null

  if (!role) {
    // Compte sans rôle : la page de connexion affiche le message adéquat.
    return chemin === "/login" ? response : rediriger("/login")
  }

  if (chemin === "/" || chemin === "/login") {
    return rediriger(ACCUEIL_PAR_ROLE[role])
  }

  if (autorises && !autorises.includes(role)) {
    return rediriger(ACCUEIL_PAR_ROLE[role])
  }

  return response
}
