import type { Role } from "@/types"

export const ACCUEIL_PAR_ROLE: Record<Role, string> = {
  vendeur: "/vendeur/commande",
  boulanger: "/fornil",
  admin: "/admin",
}

/** Préfixes protégés et rôles autorisés (l'admin a accès à tout). */
const ACCES: { prefixe: string; roles: Role[] }[] = [
  { prefixe: "/admin", roles: ["admin"] },
  { prefixe: "/fornil", roles: ["boulanger", "admin"] },
  { prefixe: "/vendeur", roles: ["vendeur", "admin"] },
]

export function rolesAutorises(chemin: string): Role[] | null {
  const regle = ACCES.find((r) => chemin === r.prefixe || chemin.startsWith(`${r.prefixe}/`))
  return regle ? regle.roles : null
}

export function estRole(valeur: unknown): valeur is Role {
  return valeur === "vendeur" || valeur === "boulanger" || valeur === "admin"
}
