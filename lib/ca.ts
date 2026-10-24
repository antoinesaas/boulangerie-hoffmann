// Agrégations du chiffre d'affaires (fonctions pures, côté client).

import { arrondi, joursEntre } from "@/lib/utils"
import type { Client, LigneCAJour, LigneVenteProduitJour, StatutCommande, TypeClient, Unite } from "@/types"

export interface Totaux {
  nb: number
  ht: number
  ttc: number
}

const VIDE: Totaux = { nb: 0, ht: 0, ttc: 0 }

/** Réalisé = préparées + livrées. Prévisionnel = + en attente. */
export function statutsComptes(inclureEnAttente: boolean): StatutCommande[] {
  return inclureEnAttente ? ["en_attente", "preparee", "livree"] : ["preparee", "livree"]
}

export function filtrer<T extends { statut: StatutCommande; date_livraison: string }>(
  lignes: T[],
  statuts: StatutCommande[],
  debut: string,
  fin: string,
): T[] {
  return lignes.filter((l) => statuts.includes(l.statut) && l.date_livraison >= debut && l.date_livraison <= fin)
}

export function totaliser(lignes: Pick<LigneCAJour, "nb_commandes" | "total_ht" | "total_ttc">[]): Totaux {
  const t = lignes.reduce(
    (acc, l) => ({ nb: acc.nb + l.nb_commandes, ht: acc.ht + Number(l.total_ht), ttc: acc.ttc + Number(l.total_ttc) }),
    VIDE,
  )
  return { nb: t.nb, ht: arrondi(t.ht), ttc: arrondi(t.ttc) }
}

export function parJour(lignes: LigneCAJour[], debut: string, fin: string): (Totaux & { date: string })[] {
  return joursEntre(debut, fin).map((date) => ({ date, ...totaliser(lignes.filter((l) => l.date_livraison === date)) }))
}

export function parPointDeVente(
  lignes: LigneCAJour[],
  pointsDeVente: { id: string; nom: string }[],
): (Totaux & { cle: string; nom: string })[] {
  const resultat = pointsDeVente.map((p) => ({
    cle: p.id,
    nom: p.nom,
    ...totaliser(lignes.filter((l) => l.point_de_vente_id === p.id)),
  }))
  const connus = new Set(pointsDeVente.map((p) => p.id))
  const autres = lignes.filter((l) => !l.point_de_vente_id || !connus.has(l.point_de_vente_id))
  if (autres.length) resultat.push({ cle: "autres", nom: "Sans point de vente", ...totaliser(autres) })
  return resultat
}

export interface LigneLivraison extends Totaux {
  cle: string
  libelle: string
  groupe: TypeClient
}

const ORDRE_GROUPE: TypeClient[] = ["point_de_vente", "tournee", "marche", "professionnel", "regulier", "occasionnel"]

/**
 * Tableau « CA par type de livraison » : partition des commandes par segment client.
 * Points de vente, tournées et pros détaillés par client ; marché et particuliers regroupés.
 * Les clients pros actifs apparaissent même à 0 €.
 */
export function parTypeLivraison(
  lignes: LigneCAJour[],
  clientsPros: Pick<Client, "id" | "nom" | "type">[],
  ordrePointsDeVente: string[] = [],
): LigneLivraison[] {
  const segments = new Map<string, LigneLivraison>()
  const cleDe = (type: TypeClient, clientId: string | null) =>
    type === "marche" || type === "regulier" || type === "occasionnel" ? type : `${type}:${clientId}`
  const libelleDe = (type: TypeClient, nom: string | null) => {
    switch (type) {
      case "point_de_vente":
        return `Point de vente — ${nom}`
      case "tournee":
        return `Tournée — ${nom}`
      case "professionnel":
        return `Professionnel — ${nom}`
      case "marche":
        return "Marché"
      case "regulier":
        return "Particuliers réguliers"
      case "occasionnel":
        return "Particuliers occasionnels"
    }
  }
  const assurer = (type: TypeClient, clientId: string | null, nom: string | null) => {
    const cle = cleDe(type, clientId)
    let seg = segments.get(cle)
    if (!seg) {
      seg = { cle, libelle: libelleDe(type, nom), groupe: type, ...VIDE }
      segments.set(cle, seg)
    }
    return seg
  }

  for (const c of clientsPros) assurer(c.type, c.id, c.nom)
  assurer("marche", null, null)
  assurer("regulier", null, null)
  assurer("occasionnel", null, null)

  for (const l of lignes) {
    const seg = assurer(l.client_type, l.client_id, l.client_nom)
    seg.nb += l.nb_commandes
    seg.ht += Number(l.total_ht)
    seg.ttc += Number(l.total_ttc)
  }

  // Points de vente dans l'ordre défini par le patron (Coffret, Merveille, Lermberg…), puis alphabétique.
  const rangPdv = (s: LigneLivraison) => {
    const i = ordrePointsDeVente.findIndex((nom) => s.libelle === `Point de vente — ${nom}`)
    return i === -1 ? ordrePointsDeVente.length : i
  }
  return [...segments.values()]
    .map((s) => ({ ...s, ht: arrondi(s.ht), ttc: arrondi(s.ttc) }))
    .sort(
      (a, b) =>
        ORDRE_GROUPE.indexOf(a.groupe) - ORDRE_GROUPE.indexOf(b.groupe) ||
        (a.groupe === "point_de_vente" ? rangPdv(a) - rangPdv(b) : 0) ||
        a.libelle.localeCompare(b.libelle, "fr"),
    )
}

export interface LigneTopProduit {
  produit_id: string
  nom: string
  unite: Unite
  quantite: number
  ht: number
  ttc: number
}

export function topProduits(lignes: LigneVenteProduitJour[]): LigneTopProduit[] {
  const parProduit = new Map<string, LigneTopProduit>()
  for (const l of lignes) {
    const p = parProduit.get(l.produit_id) ?? {
      produit_id: l.produit_id,
      nom: l.produit_nom,
      unite: l.unite,
      quantite: 0,
      ht: 0,
      ttc: 0,
    }
    p.quantite += Number(l.quantite)
    p.ht += Number(l.total_ht)
    p.ttc += Number(l.total_ttc)
    parProduit.set(l.produit_id, p)
  }
  return [...parProduit.values()]
    .map((p) => ({ ...p, quantite: arrondi(p.quantite), ht: arrondi(p.ht), ttc: arrondi(p.ttc) }))
    .sort((a, b) => b.quantite - a.quantite || b.ttc - a.ttc)
}

/** CSV compatible Excel FR : séparateur « ; », virgule décimale, BOM UTF-8. */
export function versCSV(entetes: string[], lignes: (string | number)[][]): string {
  const cellule = (v: string | number) => {
    const texte = typeof v === "number" ? v.toFixed(2).replace(".", ",") : v
    return /[;"\n]/.test(texte) ? `"${texte.replace(/"/g, '""')}"` : texte
  }
  return "﻿" + [entetes, ...lignes].map((l) => l.map(cellule).join(";")).join("\r\n")
}

export function telechargerFichier(nom: string, contenu: string, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([contenu], { type }))
  const lien = document.createElement("a")
  lien.href = url
  lien.download = nom
  document.body.appendChild(lien)
  lien.click()
  lien.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1_000)
}
