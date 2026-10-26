import { ClockIcon, RepeatIcon, StoreIcon } from "lucide-react"
import { cn, formatHeure, formatPrix, formatQuantite, formatUnite, libelleJour } from "@/lib/utils"
import { LIBELLES_TYPE_CLIENT, type CommandeDetail } from "@/types"
import { BadgeStatut } from "./BadgeStatut"

interface Props {
  commande: CommandeDetail
  actions?: React.ReactNode
  afficherDate?: boolean
  afficherPointDeVente?: boolean
  className?: string
}

/** Carte récapitulative d'une commande (vendeur / admin). */
export function CarteCommande({ commande, actions, afficherDate, afficherPointDeVente, className }: Props) {
  const annulee = commande.statut === "annulee"
  return (
    <article className={cn("rounded-xl border bg-background p-4", annulee && "opacity-60", className)}>
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold">{commande.client?.nom ?? "Client supprimé"}</h3>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            {commande.client && <span>{LIBELLES_TYPE_CLIENT[commande.client.type]}</span>}
            <span className="inline-flex items-center gap-1">
              <ClockIcon className="size-3" /> saisie {formatHeure(commande.cree_le)}
            </span>
            {afficherDate && <span>· {libelleJour(commande.date_livraison)}</span>}
            {commande.recurrente_id && (
              <span className="inline-flex items-center gap-1 font-medium text-foreground">
                <RepeatIcon className="size-3" /> chaque semaine
              </span>
            )}
            {afficherPointDeVente && commande.point_de_vente && (
              <span className="inline-flex items-center gap-1">
                <StoreIcon className="size-3" /> {commande.point_de_vente.nom}
              </span>
            )}
          </p>
        </div>
        <BadgeStatut statut={commande.statut} />
      </header>

      <ul className="mt-3 space-y-1">
        {commande.lignes.map((l) => (
          <li key={l.id} className="flex items-baseline gap-2">
            <span className="min-w-10 text-right font-semibold tabular-nums">{formatQuantite(l.quantite)}</span>
            <span className="flex-1">
              {l.produit?.nom ?? "Produit supprimé"}
              {l.produit && l.produit.unite !== "pièce" && (
                <span className="text-muted-foreground"> ({formatUnite(l.produit.unite, l.quantite)})</span>
              )}
            </span>
          </li>
        ))}
      </ul>

      {commande.notes && <p className="mt-2 text-sm italic text-muted-foreground">« {commande.notes} »</p>}

      <footer className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <span className="font-semibold tabular-nums">{formatPrix(commande.total_ttc)} TTC</span>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </footer>
    </article>
  )
}
