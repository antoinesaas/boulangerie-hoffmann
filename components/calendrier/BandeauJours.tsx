"use client"

import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useComptesJours } from "@/lib/hooks/useComptesJours"
import {
  ajouterJours,
  ajouterMois,
  aujourdhui,
  cn,
  debutMois,
  debutSemaine,
  finMois,
  finSemaine,
  formatJourMoisCourt,
  formatJourSemaine,
  formatMoisAnnee,
  joursEntre,
} from "@/lib/utils"

export const NB_JOURS_BANDEAU = 7

interface Props {
  jour: string
  surChoix: (jour: string) => void
  /** Commandes en attente par jour (affichées sous chaque jour). */
  enAttente: (jour: string) => number
  pointDeVenteId?: string | null
  grand?: boolean
  className?: string
}

/** Les 7 prochains jours par leur nom (Lundi, Mardi…) + un calendrier complet pour aller plus loin. */
export function BandeauJours({ jour, surChoix, enAttente, pointDeVenteId, grand, className }: Props) {
  const [ref] = useState(aujourdhui)
  const [calendrier, setCalendrier] = useState(false)
  const jours = useMemo(() => joursEntre(ref, ajouterJours(ref, NB_JOURS_BANDEAU - 1)), [ref])
  const horsBandeau = !jours.includes(jour)

  return (
    <div className={cn("flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]", className)} role="tablist">
      {jours.map((j) => {
        const n = enAttente(j)
        const actif = j === jour
        return (
          <button
            key={j}
            role="tab"
            aria-selected={actif}
            onClick={() => surChoix(j)}
            className={cn(
              "flex shrink-0 flex-col items-center justify-center rounded-xl border-2 px-3 transition-colors",
              grand ? "min-h-16 min-w-28 flex-1" : "min-h-14 min-w-[5.5rem]",
              actif
                ? "border-primary bg-primary text-primary-foreground"
                : "border-transparent bg-muted text-foreground hover:bg-muted/70",
            )}
          >
            <span className={cn("font-semibold leading-tight", grand ? "text-lg" : "text-sm")}>
              {formatJourSemaine(j)}
            </span>
            <span className={cn("text-xs", actif ? "opacity-80" : "text-muted-foreground")}>
              {j === ref ? "aujourd'hui" : formatJourMoisCourt(j)}
            </span>
            {n > 0 && (
              <span
                className={cn(
                  "mt-0.5 rounded-full px-1.5 text-xs font-semibold tabular-nums",
                  actif ? "bg-primary-foreground/20" : "bg-amber-200 text-amber-950 dark:bg-amber-500/30 dark:text-amber-100",
                )}
              >
                {n} en attente
              </span>
            )}
          </button>
        )
      })}
      <button
        onClick={() => setCalendrier(true)}
        className={cn(
          "flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border-2 px-3 transition-colors",
          grand ? "min-h-16 min-w-28" : "min-h-14 min-w-[5.5rem]",
          horsBandeau ? "border-primary bg-primary text-primary-foreground" : "border-dashed bg-background hover:bg-muted",
        )}
      >
        <CalendarDaysIcon className="size-5" />
        <span className={cn("font-semibold leading-tight", grand ? "text-base" : "text-sm")}>
          {horsBandeau ? `${formatJourSemaine(jour).slice(0, 3)}. ${formatJourMoisCourt(jour)}` : "Calendrier"}
        </span>
      </button>

      <Dialog open={calendrier} onOpenChange={setCalendrier}>
        <DialogContent className="sm:max-w-md">
          {calendrier && (
            <CalendrierMois
              selection={jour}
              reference={ref}
              pointDeVenteId={pointDeVenteId}
              surChoix={(j) => {
                surChoix(j)
                setCalendrier(false)
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

const NOMS_JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]

/** Calendrier mensuel avec le nombre de commandes par jour. */
function CalendrierMois({
  selection,
  reference,
  pointDeVenteId,
  surChoix,
}: {
  selection: string
  reference: string
  pointDeVenteId?: string | null
  surChoix: (jour: string) => void
}) {
  const [mois, setMois] = useState(() => debutMois(selection))
  const debutGrille = debutSemaine(mois)
  const finGrille = finSemaine(finMois(mois))
  const cases = joursEntre(debutGrille, finGrille)
  const comptes = useComptesJours(debutGrille, finGrille, pointDeVenteId)

  return (
    <div className="space-y-3">
      <DialogHeader>
        <DialogTitle>Calendrier des commandes</DialogTitle>
      </DialogHeader>
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon-lg" className="size-11" onClick={() => setMois(ajouterMois(mois, -1))} aria-label="Mois précédent">
          <ChevronLeftIcon />
        </Button>
        <span className="text-lg font-semibold">{formatMoisAnnee(mois)}</span>
        <Button variant="outline" size="icon-lg" className="size-11" onClick={() => setMois(ajouterMois(mois, 1))} aria-label="Mois suivant">
          <ChevronRightIcon />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {NOMS_JOURS.map((n) => (
          <div key={n} className="py-1 text-xs font-medium text-muted-foreground">
            {n}
          </div>
        ))}
        {cases.map((j) => {
          const c = comptes.get(j)
          const dansMois = j.slice(0, 7) === mois.slice(0, 7)
          const choisi = j === selection
          return (
            <button
              key={j}
              onClick={() => surChoix(j)}
              aria-label={`${formatJourSemaine(j)} ${formatJourMoisCourt(j)}${c ? `, ${c.total} commande(s)` : ""}`}
              className={cn(
                "flex min-h-12 flex-col items-center justify-center rounded-lg text-sm transition-colors",
                choisi ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                !dansMois && !choisi && "text-muted-foreground/50",
                j === reference && !choisi && "ring-2 ring-primary ring-inset",
              )}
            >
              <span className="font-medium tabular-nums">{Number(j.slice(8))}</span>
              {c && (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[11px] font-semibold leading-4 tabular-nums",
                    choisi
                      ? "bg-primary-foreground/20"
                      : c.enAttente > 0
                        ? "bg-amber-200 text-amber-950 dark:bg-amber-500/30 dark:text-amber-100"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {c.total}
                </span>
              )}
            </button>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Le chiffre indique le nombre de commandes du jour (en orange s&apos;il en reste à préparer).
      </p>
      <Button variant="outline" className="w-full" onClick={() => surChoix(reference)}>
        Revenir à aujourd&apos;hui
      </Button>
    </div>
  )
}
