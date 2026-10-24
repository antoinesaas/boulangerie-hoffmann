"use client"

import { ArrowRightIcon, ChartColumnIcon, FlameIcon, PlusCircleIcon } from "lucide-react"
import Link from "next/link"
import { PastilleTempsReel } from "@/components/ca/DashboardCA"
import { KpiCard } from "@/components/ca/KpiCard"
import { EnTetePage } from "@/components/layout/EnTetePage"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useCommandes } from "@/lib/hooks/useCommandes"
import { ajouterJours, aujourdhui, formatDate, formatHeure, formatPrix, libelleJour } from "@/lib/utils"
import { TYPES_LIVRAISON, type CommandeDetail, type PointDeVente } from "@/types"
import { BadgeStatut } from "./BadgeStatut"

const num = "text-right tabular-nums"

export function TableauDeBord({ pointsDeVente }: { pointsDeVente: Pick<PointDeVente, "id" | "nom">[] }) {
  const jour = aujourdhui()
  const { commandes, chargement, realtime } = useCommandes({ dateDebut: jour, dateFin: ajouterJours(jour, 7) })

  const duJour = commandes.filter((c) => c.date_livraison === jour && c.statut !== "annulee")
  const enAttente = duJour.filter((c) => c.statut === "en_attente")
  const realise = duJour.filter((c) => c.statut === "preparee" || c.statut === "livree")
  const somme = (l: CommandeDetail[]) => l.reduce((s, c) => s + Number(c.total_ttc), 0)
  const demain = commandes.filter((c) => c.date_livraison === ajouterJours(jour, 1) && c.statut !== "annulee")

  const estLivraison = (c: CommandeDetail) => Boolean(c.client && TYPES_LIVRAISON.includes(c.client.type))
  const repartition = [
    ...pointsDeVente.map((p) => ({
      cle: p.id,
      nom: p.nom,
      liste: duJour.filter((c) => !estLivraison(c) && c.point_de_vente_id === p.id),
    })),
    { cle: "livraisons", nom: "Livraisons (tournées, marchés, pros)", liste: duJour.filter(estLivraison) },
  ]

  const dernieres = [...commandes].sort((a, b) => b.cree_le.localeCompare(a.cree_le)).slice(0, 8)

  return (
    <div className="space-y-6">
      <EnTetePage
        titre="Tableau de bord"
        description={
          <span className="inline-flex items-center gap-2 first-letter:uppercase">
            <PastilleTempsReel etat={realtime} /> {formatDate(jour)}
          </span>
        }
        actions={
          <>
            <Button asChild variant="outline" className="h-10">
              <Link href="/fornil">
                <FlameIcon /> Fornil
              </Link>
            </Button>
            <Button asChild className="h-10">
              <Link href="/vendeur/commande">
                <PlusCircleIcon /> Saisir une commande
              </Link>
            </Button>
          </>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy={chargement}>
        <KpiCard principal libelle="CA du jour TTC (réalisé)" valeur={formatPrix(somme(realise))} detail="Préparées + livrées" />
        <KpiCard
          libelle="CA prévu aujourd'hui"
          valeur={formatPrix(somme(duJour))}
          detail={`${duJour.length} commande${duJour.length > 1 ? "s" : ""} au total`}
        />
        <KpiCard
          libelle="En attente au fornil"
          valeur={String(enAttente.length)}
          detail={`${duJour.length - enAttente.length} préparée(s) ou livrée(s)`}
        />
        <KpiCard libelle="Commandes pour demain" valeur={String(demain.length)} detail={formatPrix(somme(demain))} />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Aujourd&apos;hui par point de vente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Point de vente</TableHead>
                    <TableHead className={num}>Commandes</TableHead>
                    <TableHead className={num}>En attente</TableHead>
                    <TableHead className={num}>CA TTC</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {repartition.map((r) => (
                    <TableRow key={r.cle}>
                      <TableCell className="font-medium">{r.nom}</TableCell>
                      <TableCell className={num}>{r.liste.length}</TableCell>
                      <TableCell className={num}>{r.liste.filter((c) => c.statut === "en_attente").length}</TableCell>
                      <TableCell className={num}>{formatPrix(somme(r.liste))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Dernières commandes saisies</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/commandes">
                Tout voir <ArrowRightIcon />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {dernieres.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Aucune commande à venir.</p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {dernieres.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <span className="w-12 shrink-0 text-muted-foreground tabular-nums">{formatHeure(c.cree_le)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{c.client?.nom}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {libelleJour(c.date_livraison, jour)} · {c.point_de_vente?.nom ?? "—"}
                      </span>
                    </span>
                    <span className="tabular-nums">{formatPrix(c.total_ttc)}</span>
                    <BadgeStatut statut={c.statut} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Button asChild variant="outline" className="h-11">
        <Link href="/admin/ca">
          <ChartColumnIcon /> Voir le chiffre d&apos;affaires détaillé
        </Link>
      </Button>
    </div>
  )
}
