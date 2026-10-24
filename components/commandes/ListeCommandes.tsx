"use client"

import { CheckCheckIcon, Loader2Icon, RefreshCwIcon, Trash2Icon, XIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { changerStatut, useCommandes } from "@/lib/hooks/useCommandes"
import { useFileAttente } from "@/lib/hooks/useFileAttente"
import { reessayerOperation, retirerOperation, synchroniser } from "@/lib/offline/fileAttente"
import { BandeauJours, NB_JOURS_BANDEAU } from "@/components/calendrier/BandeauJours"
import {
  ajouterJours,
  aujourdhui,
  formatDateHeure,
  formatJourMoisCourt,
  formatJourSemaine,
  formatPrix,
  libelleJour,
} from "@/lib/utils"
import type { CommandeDetail, PointDeVente, Role, StatutCommande } from "@/types"
import { CarteCommande } from "./CarteCommande"

interface Props {
  role: Role
  /** Vendeur : son point de vente. Admin : null = filtre libre. */
  pointDeVenteId: string | null
  pointsDeVente: Pick<PointDeVente, "id" | "nom">[]
}

/** Commandes du point de vente (vendeur), en temps réel. */
export function ListeCommandes({ role, pointDeVenteId, pointsDeVente }: Props) {
  const [jour] = useState(aujourdhui)
  const [jourActif, setJourActif] = useState(jour)
  const [filtrePdv, setFiltrePdv] = useState<string>(pointDeVenteId ?? "tous")
  const pdv = pointDeVenteId ?? (filtrePdv === "tous" ? null : filtrePdv)

  // Semaine à venir toujours chargée ; un jour choisi au calendrier élargit la plage.
  const finSemaineAVenir = ajouterJours(jour, NB_JOURS_BANDEAU - 1)
  const { commandes, chargement, erreur, majLocale } = useCommandes({
    dateDebut: jourActif < jour ? jourActif : jour,
    dateFin: jourActif > finSemaineAVenir ? jourActif : finSemaineAVenir,
    pointDeVenteId: pdv,
  })

  const visibles = commandes.filter((c) => c.date_livraison === jourActif)
  const enAttente = (j: string) => commandes.filter((c) => c.date_livraison === j && c.statut === "en_attente").length

  const totalJour = visibles.filter((c) => c.statut !== "annulee").reduce((s, c) => s + Number(c.total_ttc), 0)

  async function appliquer(c: CommandeDetail, statut: StatutCommande) {
    const precedent = c.statut
    majLocale(c.id, { statut })
    const err = await changerStatut(c.id, statut)
    if (err) {
      majLocale(c.id, { statut: precedent })
      toast.error("Action impossible", { description: err.message })
    } else {
      toast.success(statut === "livree" ? `${c.client?.nom} : livrée` : `${c.client?.nom} : annulée`)
    }
  }

  return (
    <div className="space-y-4 px-4 pt-4">
      <FileAttenteVendeur />

      {role === "admin" && (
        <Select value={filtrePdv} onValueChange={setFiltrePdv}>
          <SelectTrigger className="h-12 w-full text-base">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tous" className="min-h-11">
              Tous les points de vente
            </SelectItem>
            {pointsDeVente.map((p) => (
              <SelectItem key={p.id} value={p.id} className="min-h-11">
                {p.nom}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <BandeauJours jour={jourActif} surChoix={setJourActif} enAttente={enAttente} pointDeVenteId={pdv} />

      {erreur && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{erreur}</p>}

      {chargement ? (
        <div className="flex justify-center py-10 text-muted-foreground">
          <Loader2Icon className="animate-spin" />
        </div>
      ) : visibles.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">
          Aucune commande pour {formatJourSemaine(jourActif).toLowerCase()} {formatJourMoisCourt(jourActif)}.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {visibles.length} commande{visibles.length > 1 ? "s" : ""} · {formatPrix(totalJour)} TTC
          </p>
          <div className="space-y-3">
            {visibles.map((c) => (
              <CarteCommande
                key={c.id}
                commande={c}
                afficherDate={false}
                afficherPointDeVente={!pointDeVenteId}
                actions={
                  <>
                    {c.statut === "en_attente" && (
                      <Button
                        variant="outline"
                        className="h-11"
                        onClick={() => {
                          if (window.confirm(`Annuler la commande de ${c.client?.nom} (${libelleJour(c.date_livraison)}) ?`)) {
                            void appliquer(c, "annulee")
                          }
                        }}
                      >
                        <XIcon /> Annuler
                      </Button>
                    )}
                    {(c.statut === "en_attente" || c.statut === "preparee") && (
                      <Button className="h-11" onClick={() => void appliquer(c, "livree")}>
                        <CheckCheckIcon /> Livrée
                      </Button>
                    )}
                  </>
                }
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/** Commandes saisies sur ce téléphone et pas encore arrivées au fornil. */
function FileAttenteVendeur() {
  const file = useFileAttente()
  const commandes = file.filter((o) => o.type === "commande")
  if (commandes.length === 0) return null

  return (
    <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="font-semibold">En attente d&apos;envoi ({commandes.length})</h2>
        <Button variant="outline" className="h-11" onClick={() => void synchroniser()}>
          <RefreshCwIcon /> Renvoyer
        </Button>
      </div>
      <ul className="space-y-2">
        {commandes.map((op) =>
          op.type !== "commande" ? null : (
            <li key={op.id} className="rounded-lg bg-background p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium">{op.resume.client}</div>
                  <div className="text-muted-foreground">
                    {libelleJour(op.data.p_date_livraison)} · {op.resume.nb_articles} article(s) ·{" "}
                    {formatPrix(op.resume.total_ttc)} · saisie {formatDateHeure(op.creeLe)}
                  </div>
                </div>
              </div>
              {op.erreur ? (
                <div className="mt-2 space-y-2">
                  <p className="text-destructive">Refusée : {op.erreur}</p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="h-11"
                      onClick={() => {
                        reessayerOperation(op.id)
                        void synchroniser()
                      }}
                    >
                      <RefreshCwIcon /> Réessayer
                    </Button>
                    <Button
                      variant="destructive"
                      className="h-11"
                      onClick={() => window.confirm("Supprimer définitivement cette commande non envoyée ?") && retirerOperation(op.id)}
                    >
                      <Trash2Icon /> Supprimer
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="mt-1 text-amber-800 dark:text-amber-200">En attente du réseau…</p>
              )}
            </li>
          ),
        )}
      </ul>
    </section>
  )
}

