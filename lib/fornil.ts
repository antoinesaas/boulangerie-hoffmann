// Calculs du fornil (fonctions pures, testées dans tests/fornil.test.ts).
// Le fornil n'a pas besoin de savoir qui a commandé : il produit des quantités
// et les envoie à une destination (une boutique, ou un client livré en tournée).

import type { CommandeDetail } from "@/types"

const TYPES_LIVRAISON = ["tournee", "marche", "professionnel"]

export interface Destination {
  cle: string
  nom: string
  livraison: boolean
  /** Commandes du jour non annulées. */
  commandes: CommandeDetail[]
}

export interface LigneProduit {
  produit_id: string
  nom: string
  unite: string
  ordre: number
  quantite: number
}

export interface LigneAProduire extends LigneProduit {
  /** Quantité totale commandée pour le jour. */
  total: number
  /** Quantité considérée comme faite (pointée au fornil, ou déjà préparée/envoyée). */
  faite: number
  reste: number
}

const arrondi = (n: number) => Math.round(n * 1000) / 1000

export function estLivraison(c: CommandeDetail): boolean {
  return Boolean(c.client && TYPES_LIVRAISON.includes(c.client.type))
}

/**
 * Regroupe les commandes par destination : chaque boutique (dans l'ordre défini par le patron),
 * puis chaque client livré en tournée / marché / pro, puis « Autres » (sans boutique).
 */
export function grouperParDestination(
  commandes: CommandeDetail[],
  boutiques: { id: string; nom: string }[],
): Destination[] {
  const actives = commandes.filter((c) => c.statut !== "annulee")
  const resultat: Destination[] = boutiques.map((b) => ({
    cle: b.id,
    nom: b.nom,
    livraison: false,
    commandes: actives.filter((c) => !estLivraison(c) && c.point_de_vente_id === b.id),
  }))

  const connues = new Set(boutiques.map((b) => b.id))
  const autres = actives.filter((c) => !estLivraison(c) && !connues.has(c.point_de_vente_id ?? ""))
  if (autres.length) resultat.push({ cle: "autres", nom: "Autres", livraison: false, commandes: autres })

  const livraisons = new Map<string, Destination>()
  for (const c of actives.filter(estLivraison)) {
    const cle = `livraison:${c.client_id}`
    const d = livraisons.get(cle) ?? { cle, nom: c.client?.nom ?? "Client", livraison: true, commandes: [] }
    d.commandes.push(c)
    livraisons.set(cle, d)
  }
  resultat.push(...[...livraisons.values()].sort((a, b) => a.nom.localeCompare(b.nom, "fr")))

  return resultat.filter((d) => d.commandes.length > 0)
}

/** Additionne les quantités par produit (toutes commandes confondues). */
export function sommeProduits(commandes: CommandeDetail[]): LigneProduit[] {
  const parProduit = new Map<string, LigneProduit>()
  for (const c of commandes) {
    for (const l of c.lignes) {
      const p = parProduit.get(l.produit_id) ?? {
        produit_id: l.produit_id,
        nom: l.produit?.nom ?? "Produit",
        unite: l.produit?.unite ?? "pièce",
        ordre: l.produit?.ordre ?? 0,
        quantite: 0,
      }
      p.quantite = arrondi(p.quantite + Number(l.quantite))
      parProduit.set(l.produit_id, p)
    }
  }
  return [...parProduit.values()].sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom, "fr"))
}

/** Clé d'une quantité pointée : une destination et un produit. */
export function cleProduction(destination: string, produitId: string): string {
  return `${destination}|${produitId}`
}

export interface ProductionDestination {
  destination: Destination
  /** Une ligne par produit à envoyer à cette destination (commandes + habituelle). */
  lignes: LigneAProduire[]
}

/**
 * Décompte par destination. Un produit est fait, pour une destination, à hauteur du plus grand de :
 * ce que le fornil a validé pour elle, ou ce qui est déjà parti dans ses commandes préparées/livrées.
 */
export function productionParDestination(
  destinations: Destination[],
  pointees: Map<string, number>,
): ProductionDestination[] {
  return destinations.map((d) => {
    const parties = sommeProduits(d.commandes.filter((c) => c.statut === "preparee" || c.statut === "livree"))
    const dejaParti = new Map(parties.map((p) => [p.produit_id, p.quantite]))
    const lignes = sommeProduits(d.commandes).map((p) => {
      const pointe = pointees.get(cleProduction(d.cle, p.produit_id)) ?? 0
      const faite = Math.min(p.quantite, Math.max(pointe, dejaParti.get(p.produit_id) ?? 0))
      return { ...p, total: p.quantite, faite, reste: arrondi(p.quantite - faite) }
    })
    return { destination: d, lignes }
  })
}

/** Total général par produit (toutes destinations) : ce qu'il reste à produire sur ce qui est commandé. */
export function recapProduction(par: ProductionDestination[]): LigneAProduire[] {
  const parProduit = new Map<string, LigneAProduire>()
  for (const { lignes } of par) {
    for (const l of lignes) {
      const r = parProduit.get(l.produit_id) ?? { ...l, quantite: 0, total: 0, faite: 0, reste: 0 }
      r.total = arrondi(r.total + l.total)
      r.quantite = r.total
      r.faite = arrondi(r.faite + l.faite)
      r.reste = arrondi(r.reste + l.reste)
      parProduit.set(l.produit_id, r)
    }
  }
  return [...parProduit.values()].sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom, "fr"))
}

/** Commandes d'une destination encore à préparer. */
export function aPreparer(d: Destination): CommandeDetail[] {
  return d.commandes.filter((c) => c.statut === "en_attente")
}
