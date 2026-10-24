/** Prix TTC à partir d'un HT et d'un taux de TVA en % (5.5, 10…). */
export function calcTTC(prixHT: number, tva: number): number {
  return arrondi(prixHT * (1 + tva / 100))
}

/** Arrondi monétaire à 2 décimales (évite les 0.1 + 0.2). */
export function arrondi(valeur: number): number {
  return Math.round((valeur + Number.EPSILON) * 100) / 100
}

/** Total d'une liste de lignes { quantite, prix HT, tva }. */
export function totalLignes(lignes: { quantite: number; prix_ht: number; tva: number }[]) {
  let ht = 0
  let ttc = 0
  for (const l of lignes) {
    ht += l.quantite * l.prix_ht
    ttc += l.quantite * l.prix_ht * (1 + l.tva / 100)
  }
  return { ht: arrondi(ht), ttc: arrondi(ttc) }
}

/** Variation en % entre deux valeurs (null si la base est nulle). */
export function variation(actuel: number, precedent: number): number | null {
  if (!precedent) return null
  return ((actuel - precedent) / precedent) * 100
}
