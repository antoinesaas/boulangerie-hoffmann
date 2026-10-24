import "server-only"

import { createHash, randomBytes, randomInt, randomUUID } from "node:crypto"

export const DUREE_CODE_MINUTES = 15
export const ESSAIS_MAX = 5

/** Code d'activation à 6 chiffres, facile à taper sur un téléphone. */
export function nouveauCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0")
}

export function hacherCode(code: string): string {
  return createHash("sha256").update(`boulangerie-hoffmann:${code}`).digest("hex")
}

/** Identifiants techniques d'un appareil : jamais affichés, jamais stockés en clair. */
export function identifiantsAppareil() {
  return {
    email: `appareil-${randomUUID()}@appareils.boulangerie-hoffmann.app`,
    motDePasse: randomBytes(32).toString("base64url"),
  }
}
