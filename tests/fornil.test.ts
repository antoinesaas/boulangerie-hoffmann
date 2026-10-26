// Tests du décompte et des envois du fornil, sur une journée réaliste.
// Lancer : npm test
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  aPreparer,
  cleProduction,
  grouperParDestination,
  productionParDestination,
  recapProduction,
  sommeProduits,
} from "../lib/fornil.ts"
import type { CommandeDetail, StatutCommande, TypeClient } from "../types/index.ts"

const BOUTIQUES = [
  { id: "pdv-coffret", nom: "Coffret" },
  { id: "pdv-merveille", nom: "Merveille" },
  { id: "pdv-lermberg", nom: "Lermberg" },
]
const PRODUITS = {
  trad: { id: "p-trad", nom: "Baguette tradition", unite: "pièce" as const, categorie: "pain" as const, ordre: 1 },
  campagne: { id: "p-campagne", nom: "Pain de campagne", unite: "pièce" as const, categorie: "pain" as const, ordre: 2 },
  croissant: { id: "p-croissant", nom: "Croissant", unite: "pièce" as const, categorie: "viennoiserie" as const, ordre: 3 },
}

let n = 0
function commande(
  client: { nom: string; type: TypeClient },
  pdv: string,
  lignes: [keyof typeof PRODUITS, number][],
  statut: StatutCommande = "en_attente",
  notes: string | null = null,
): CommandeDetail {
  n++
  const clientId = `c-${client.nom}`
  return {
    id: `cmd-${n}`,
    client_id: clientId,
    point_de_vente_id: pdv,
    date_livraison: "2026-10-25",
    statut,
    notes,
    cree_par: null,
    cree_le: "2026-10-24T08:00:00Z",
    prepare_le: null,
    total_ht: 0,
    total_ttc: 0,
    recurrente_id: null,
    client: { id: clientId, nom: client.nom, type: client.type, telephone: null },
    point_de_vente: BOUTIQUES.find((b) => b.id === pdv) ?? null,
    lignes: lignes.map(([p, q], i) => ({
      id: `l-${n}-${i}`,
      commande_id: `cmd-${n}`,
      produit_id: PRODUITS[p].id,
      quantite: q,
      prix_unitaire_ht: 1,
      tva: 5.5,
      produit: PRODUITS[p],
    })),
  }
}

// Dimanche 25/10 : habituelle de Coffret, M. Bertrand commandé à Coffret, Merveille, et l'Armée en tournée.
function journee() {
  n = 0
  return [
    commande({ nom: "Coffret", type: "point_de_vente" }, "pdv-coffret", [["trad", 90], ["croissant", 40]]),
    commande({ nom: "M. Bertrand", type: "regulier" }, "pdv-coffret", [["trad", 1]], "en_attente", "bien cuite"),
    commande({ nom: "Merveille", type: "point_de_vente" }, "pdv-merveille", [["trad", 30], ["campagne", 5]]),
    commande({ nom: "Armée", type: "tournee" }, "pdv-coffret", [["trad", 20]]),
    commande({ nom: "Mme Annulée", type: "occasionnel" }, "pdv-coffret", [["trad", 3]], "annulee"),
  ]
}

describe("Envois par destination", () => {
  it("regroupe la commande de M. Bertrand avec l'habituelle de Coffret (sans le détail client)", () => {
    const d = grouperParDestination(journee(), BOUTIQUES)
    const coffret = d.find((x) => x.nom === "Coffret")!
    assert.deepEqual(
      sommeProduits(aPreparer(coffret)).map((p) => [p.nom, p.quantite]),
      [
        ["Baguette tradition", 91],
        ["Croissant", 40],
      ],
    )
  })

  it("met les tournées à part, une carte par client livré", () => {
    const d = grouperParDestination(journee(), BOUTIQUES)
    assert.deepEqual(
      d.map((x) => [x.nom, x.livraison]),
      [
        ["Coffret", false],
        ["Merveille", false],
        ["Armée", true],
      ],
    )
  })

  it("ignore les commandes annulées et les boutiques sans commande", () => {
    const d = grouperParDestination(journee(), BOUTIQUES)
    assert.equal(d.find((x) => x.nom === "Lermberg"), undefined)
    assert.ok(d.every((x) => x.commandes.every((c) => c.statut !== "annulee")))
  })

  it("une fois Coffret prêt, plus aucune commande Coffret ne reste en attente (y compris M. Bertrand)", () => {
    const cmds = journee().map((c) => (c.point_de_vente_id === "pdv-coffret" && c.client?.type !== "tournee" ? { ...c, statut: "preparee" as const } : c))
    const coffret = grouperParDestination(cmds, BOUTIQUES).find((x) => x.nom === "Coffret")!
    assert.equal(aPreparer(coffret).length, 0)
  })
})

function production(cmds: CommandeDetail[], pointees = new Map<string, number>()) {
  const par = productionParDestination(grouperParDestination(cmds, BOUTIQUES), pointees)
  const reste = (dest: string, produit: string) =>
    par.find((p) => p.destination.nom === dest)?.lignes.find((l) => l.nom === produit)?.reste
  const total = (produit: string) => recapProduction(par).find((l) => l.nom === produit)
  return { par, reste, total }
}

describe("Décompte « À produire » par magasin", () => {
  it("chaque magasin a son total, commandes et habituelle confondues (Coffret : 91 trads)", () => {
    const { reste } = production(journee())
    assert.equal(reste("Coffret", "Baguette tradition"), 91)
    assert.equal(reste("Coffret", "Croissant"), 40)
    assert.equal(reste("Merveille", "Baguette tradition"), 30)
    assert.equal(reste("Armée", "Baguette tradition"), 20)
  })

  it("le bandeau total additionne tous les magasins : 141 trads, 40 croissants, 5 campagnes", () => {
    const { total } = production(journee())
    assert.equal(total("Baguette tradition")!.reste, 141)
    assert.equal(total("Croissant")!.reste, 40)
    assert.equal(total("Pain de campagne")!.reste, 5)
  })

  it("valider « 91 baguettes finies » pour Coffret ne touche pas Merveille, et baisse le total", () => {
    const pointees = new Map([[cleProduction("pdv-coffret", "p-trad"), 91]])
    const { reste, total } = production(journee(), pointees)
    assert.equal(reste("Coffret", "Baguette tradition"), 0)
    assert.equal(reste("Merveille", "Baguette tradition"), 30)
    assert.equal(total("Baguette tradition")!.reste, 50)
  })

  it("une commande déjà préparée compte comme produite pour son magasin", () => {
    const cmds = journee().map((c) => (c.client?.nom === "Merveille" ? { ...c, statut: "preparee" as const } : c))
    const { reste } = production(cmds)
    assert.equal(reste("Merveille", "Pain de campagne"), 0)
    assert.equal(reste("Coffret", "Baguette tradition"), 91)
  })

  it("une commande arrivée après la validation ne fait réapparaître que la différence", () => {
    const pointees = new Map([[cleProduction("pdv-coffret", "p-trad"), 91]])
    const plusTard = [...journee(), commande({ nom: "M. Durand", type: "occasionnel" }, "pdv-coffret", [["trad", 2]])]
    assert.equal(production(plusTard, pointees).reste("Coffret", "Baguette tradition"), 2)
  })

  it("ne descend jamais sous zéro", () => {
    const pointees = new Map([[cleProduction("pdv-coffret", "p-trad"), 500]])
    assert.equal(production(journee(), pointees).reste("Coffret", "Baguette tradition"), 0)
  })
})
