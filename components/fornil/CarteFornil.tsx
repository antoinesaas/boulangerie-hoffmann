"use client"

import { CheckIcon, ClockIcon, Loader2Icon, StoreIcon, Undo2Icon } from "lucide-react"
import { BadgeStatut } from "@/components/commandes/BadgeStatut"
import { Button } from "@/components/ui/button"
import { cn, formatHeure, formatQuantite, formatUnite } from "@/lib/utils"
import { LIBELLES_TYPE_CLIENT, type CommandeDetail } from "@/types"

interface Props {
  commande: CommandeDetail
  nouvelle: boolean
  enCours: boolean
  afficherPointDeVente: boolean
  surPreparee: () => void
  surAnnulerPreparee: () => void
}

/** Carte de production : lisible à 60 cm, un seul gros bouton d'action. */
export function CarteFornil({
  commande,
  nouvelle,
  enCours,
  afficherPointDeVente,
  surPreparee,
  surAnnulerPreparee,
}: Props) {
  const preparee = commande.statut === "preparee" || commande.statut === "livree"

  return (
    <article
      className={cn(
        "carte-fornil flex flex-col rounded-2xl border-2 bg-card p-4 shadow-sm transition-all duration-500",
        preparee && "border-emerald-500/40 bg-emerald-50/60 opacity-75 dark:bg-emerald-950/30",
        !preparee && "border-border",
        nouvelle && "animate-in fade-in slide-in-from-top-4 border-amber-400 ring-4 ring-amber-400/40 duration-700",
      )}
    >
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-2xl font-bold leading-tight">{commande.client?.nom ?? "Client supprimé"}</h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-base text-muted-foreground">
            {commande.client && <span>{LIBELLES_TYPE_CLIENT[commande.client.type]}</span>}
            <span className="inline-flex items-center gap-1">
              <ClockIcon className="size-4" /> {formatHeure(commande.cree_le)}
            </span>
            {afficherPointDeVente && commande.point_de_vente && (
              <span className="inline-flex items-center gap-1">
                <StoreIcon className="size-4" /> {commande.point_de_vente.nom}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {nouvelle && (
            <span className="rounded-full bg-amber-400 px-2.5 py-0.5 text-xs font-bold uppercase text-amber-950 print:hidden">
              Nouveau
            </span>
          )}
          <BadgeStatut statut={commande.statut} className="text-sm" />
        </div>
      </header>

      <ul className="my-4 flex-1 space-y-1.5">
        {commande.lignes.map((l) => (
          <li key={l.id} className="flex items-baseline gap-3">
            <span className="min-w-14 text-right text-3xl font-black tabular-nums leading-none">
              {formatQuantite(l.quantite)}
            </span>
            <span className={cn("text-xl font-medium leading-tight", preparee && "line-through decoration-2 opacity-70")}>
              {l.produit?.nom ?? "Produit supprimé"}
              {l.produit && l.produit.unite !== "pièce" && (
                <span className="text-base text-muted-foreground"> {formatUnite(l.produit.unite, l.quantite)}</span>
              )}
            </span>
          </li>
        ))}
      </ul>

      {commande.notes && (
        <p className="mb-4 rounded-lg bg-amber-100/70 px-3 py-2 text-lg italic text-amber-950 dark:bg-amber-500/15 dark:text-amber-100">
          {commande.notes}
        </p>
      )}

      <div className="print:hidden">
        {commande.statut === "en_attente" ? (
          <Button
            onClick={surPreparee}
            disabled={enCours}
            className="h-16 w-full rounded-xl bg-emerald-600 text-xl font-bold text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            {enCours ? <Loader2Icon className="size-6 animate-spin" /> : <CheckIcon className="size-7 stroke-[3]" />}
            Préparée
          </Button>
        ) : commande.statut === "preparee" ? (
          <Button variant="outline" onClick={surAnnulerPreparee} disabled={enCours} className="h-12 w-full text-base">
            <Undo2Icon className="size-5" /> Remettre en attente
          </Button>
        ) : null}
      </div>
    </article>
  )
}
