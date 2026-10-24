"use client"

import { useMemo, useState } from "react"
import { EnTetePage } from "@/components/layout/EnTetePage"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { filtrer, parJour, parPointDeVente, parTypeLivraison, statutsComptes, topProduits, totaliser } from "@/lib/ca"
import { useCA } from "@/lib/hooks/useCA"
import type { EtatRealtime } from "@/lib/hooks/useRealtime"
import {
  ajouterJours,
  aujourdhui,
  cn,
  debutMois,
  debutSemaine,
  finMois,
  finSemaine,
  formatDate,
  formatDateCourte,
  formatPrix,
  variation,
} from "@/lib/utils"
import type { Client, PointDeVente } from "@/types"
import { GraphiqueCAJours, GraphiqueCAPointsDeVente } from "./GraphiqueCA"
import { KpiCard } from "./KpiCard"
import { TableauJours, TableauLivraisons, TableauTopProduits } from "./TableauCA"

type Periode = "jour" | "semaine" | "mois" | "perso"

interface Props {
  pointsDeVente: Pick<PointDeVente, "id" | "nom">[]
  clientsPros: Pick<Client, "id" | "nom" | "type">[]
}

export function DashboardCA({ pointsDeVente, clientsPros }: Props) {
  const [jour] = useState(aujourdhui)
  const [inclureAttente, setInclureAttente] = useState(false)
  const statuts = statutsComptes(inclureAttente)

  // Fenêtre des chiffres clés : mois en cours, semaine N et N-1, 7 derniers jours.
  const fenetre = useMemo(() => {
    const debut = [debutMois(jour), ajouterJours(debutSemaine(jour), -7), ajouterJours(jour, -6)].sort()[0]
    const fin = [finSemaine(jour), finMois(jour)].sort()[1]
    return { debut, fin }
  }, [jour])
  const cles = useCA(fenetre.debut, fenetre.fin)
  const lignesCles = cles.ca.filter((l) => statuts.includes(l.statut))

  const kpi = useMemo(() => {
    const total = (d: string, f: string) => totaliser(filtrer(lignesCles, statuts, d, f))
    const lundi = debutSemaine(jour)
    const ecoule = Math.round((Date.parse(jour) - Date.parse(lundi)) / 86_400_000)
    const semaineADate = total(lundi, jour)
    const semainePrecADate = total(ajouterJours(lundi, -7), ajouterJours(lundi, -7 + ecoule))
    return {
      jour: total(jour, jour),
      hier: total(ajouterJours(jour, -1), ajouterJours(jour, -1)),
      semaine: total(lundi, finSemaine(jour)),
      mois: total(debutMois(jour), finMois(jour)),
      semaineADate,
      semainePrecADate,
      evolution: variation(semaineADate.ttc, semainePrecADate.ttc),
    }
  }, [lignesCles, statuts, jour])

  const septJours = useMemo(() => parJour(lignesCles, ajouterJours(jour, -6), jour), [lignesCles, jour])

  // Période d'analyse : un seul filtre pour les sections 3 à 5.
  const [periode, setPeriode] = useState<Periode>("semaine")
  const [persoDebut, setPersoDebut] = useState(debutMois(jour))
  const [persoFin, setPersoFin] = useState(jour)
  const bornes: Record<Periode, [string, string]> = {
    jour: [jour, jour],
    semaine: [debutSemaine(jour), finSemaine(jour)],
    mois: [debutMois(jour), finMois(jour)],
    perso: persoDebut <= persoFin ? [persoDebut, persoFin] : [persoFin, persoDebut],
  }
  const [debut, fin] = bornes[periode]
  const analyse = useCA(debut, fin, { produits: true })
  const lignesAnalyse = analyse.ca.filter((l) => statuts.includes(l.statut))
  const ventesAnalyse = analyse.ventes.filter((l) => statuts.includes(l.statut))

  const parPdv = useMemo(() => parPointDeVente(lignesAnalyse, pointsDeVente), [lignesAnalyse, pointsDeVente])
  const livraisons = useMemo(() => parTypeLivraison(lignesAnalyse, clientsPros), [lignesAnalyse, clientsPros])
  const top = useMemo(() => topProduits(ventesAnalyse), [ventesAnalyse])
  const libellePeriode = debut === fin ? formatDate(debut) : `du ${formatDateCourte(debut)} au ${formatDateCourte(fin)}`

  return (
    <div className="space-y-8">
      <EnTetePage
        titre="Chiffre d'affaires"
        description={
          <span className="inline-flex items-center gap-2">
            <PastilleTempsReel etat={cles.realtime} />
            {inclureAttente
              ? "Prévisionnel : commandes en attente, préparées et livrées."
              : "Réalisé : commandes préparées et livrées."}
          </span>
        }
        actions={
          <div className="flex min-h-11 items-center gap-3 rounded-lg border bg-background px-3">
            <Switch id="inclure-attente" checked={inclureAttente} onCheckedChange={setInclureAttente} />
            <Label htmlFor="inclure-attente" className="cursor-pointer">
              Inclure les commandes en attente
            </Label>
          </div>
        }
      />

      {cles.erreur && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{cles.erreur}</p>}

      {/* Section 1 — chiffres clés */}
      <section
        aria-label="Chiffres clés"
        className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-4 transition-opacity", cles.chargement && "opacity-60")}
      >
        <KpiCard
          principal
          libelle="CA du jour TTC"
          valeur={formatPrix(kpi.jour.ttc)}
          variation={variation(kpi.jour.ttc, kpi.hier.ttc)}
          libelleVariation="vs hier"
          detail={`${kpi.jour.nb} commande${kpi.jour.nb > 1 ? "s" : ""} · ${formatPrix(kpi.jour.ht)} HT`}
        />
        <KpiCard
          libelle="Semaine en cours"
          valeur={formatPrix(kpi.semaine.ttc)}
          detail={`${kpi.semaine.nb} commandes · ${formatPrix(kpi.semaine.ht)} HT`}
        />
        <KpiCard
          libelle="Mois en cours"
          valeur={formatPrix(kpi.mois.ttc)}
          detail={`${kpi.mois.nb} commandes · ${formatPrix(kpi.mois.ht)} HT`}
        />
        <KpiCard
          libelle="Semaine N vs N-1"
          valeur={formatPrix(kpi.semaineADate.ttc)}
          variation={kpi.evolution}
          libelleVariation={`vs ${formatPrix(kpi.semainePrecADate.ttc)}`}
          detail="Du lundi à aujourd'hui, comparé aux mêmes jours la semaine dernière"
        />
      </section>

      {/* Section 2 — CA par jour */}
      <Card className={cn("transition-opacity", cles.chargement && "opacity-60")}>
        <CardHeader>
          <CardTitle>CA TTC par jour</CardTitle>
          <CardDescription>7 derniers jours, par date de livraison</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <GraphiqueCAJours donnees={septJours} />
          <TableauJours jours={septJours} />
        </CardContent>
      </Card>

      {/* Filtre unique pour les sections 3 à 5 */}
      <div className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center gap-2 border-y bg-background/95 px-4 py-3 backdrop-blur md:top-0 md:-mx-8 md:px-8">
        <span className="mr-1 text-sm font-medium">Période d&apos;analyse</span>
        <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1" role="radiogroup" aria-label="Période">
          {(
            [
              ["jour", "Aujourd'hui"],
              ["semaine", "Cette semaine"],
              ["mois", "Ce mois"],
              ["perso", "Personnalisée"],
            ] as const
          ).map(([valeur, libelle]) => (
            <button
              key={valeur}
              role="radio"
              aria-checked={periode === valeur}
              onClick={() => setPeriode(valeur)}
              className={cn(
                "min-h-9 rounded-md px-3 text-sm font-medium transition-colors",
                periode === valeur ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {libelle}
            </button>
          ))}
        </div>
        {periode === "perso" && (
          <div className="flex items-center gap-2 text-sm">
            <label className="sr-only" htmlFor="perso-debut">
              Début
            </label>
            <input
              id="perso-debut"
              type="date"
              value={persoDebut}
              onChange={(e) => e.target.value && setPersoDebut(e.target.value)}
              className="h-10 rounded-md border bg-background px-2"
            />
            <span>→</span>
            <label className="sr-only" htmlFor="perso-fin">
              Fin
            </label>
            <input
              id="perso-fin"
              type="date"
              value={persoFin}
              onChange={(e) => e.target.value && setPersoFin(e.target.value)}
              className="h-10 rounded-md border bg-background px-2"
            />
          </div>
        )}
        <span className="text-sm text-muted-foreground first-letter:uppercase">{libellePeriode}</span>
      </div>

      {analyse.erreur && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{analyse.erreur}</p>}

      <div className={cn("grid gap-6 xl:grid-cols-5 transition-opacity", analyse.chargement && "opacity-60")}>
        {/* Section 3 — par point de vente */}
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>CA TTC par point de vente</CardTitle>
            <CardDescription>Point de vente où la commande a été saisie</CardDescription>
          </CardHeader>
          <CardContent>
            <GraphiqueCAPointsDeVente donnees={parPdv} />
          </CardContent>
        </Card>

        {/* Section 4 — par type de livraison */}
        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle>CA par type de livraison</CardTitle>
            <CardDescription className="first-letter:uppercase">{libellePeriode}</CardDescription>
          </CardHeader>
          <CardContent>
            <TableauLivraisons lignes={livraisons} nomFichier={`ca-livraisons_${debut}_${fin}.csv`} />
          </CardContent>
        </Card>
      </div>

      {/* Section 5 — top produits */}
      <Card className={cn("transition-opacity", analyse.chargement && "opacity-60")}>
        <CardHeader>
          <CardTitle>Top produits</CardTitle>
          <CardDescription>Classés par quantité commandée</CardDescription>
        </CardHeader>
        <CardContent>
          <TableauTopProduits produits={top} />
        </CardContent>
      </Card>
    </div>
  )
}

export function PastilleTempsReel({ etat }: { etat: EtatRealtime }) {
  return (
    <span
      className={cn(
        "inline-block size-2 rounded-full",
        etat === "connecte" ? "bg-emerald-500" : etat === "connexion" ? "bg-amber-400" : "bg-red-500",
      )}
      title={etat === "connecte" ? "Temps réel actif" : etat === "connexion" ? "Connexion…" : "Temps réel déconnecté"}
    />
  )
}
