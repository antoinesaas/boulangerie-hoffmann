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

  const dialogue = (
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
  )

  // Version compacte (téléphone) : les 7 jours + le calendrier tiennent sur une ligne, sans défilement.
  if (!grand) {
    return (
      <div className={cn("grid grid-cols-8 gap-1", className)} role="tablist">
        {jours.map((j) => {
          const n = enAttente(j)
          const actif = j === jour
          return (
            <button
              key={j}
              role="tab"
              aria-selected={actif}
              aria-label={`${formatJourSemaine(j)} ${formatJourMoisCourt(j)}${n ? `, ${n} en attente` : ""}`}
              onClick={() => surChoix(j)}
              className={cn(
                "relative flex min-h-14 min-w-0 flex-col items-center justify-center rounded-lg border-2 transition-colors",
                actif ? "border-primary bg-primary text-primary-foreground" : "border-transparent bg-muted text-foreground",
              )}
            >
              <span className="text-[11px] font-medium uppercase leading-none">{formatJourSemaine(j).slice(0, 3)}</span>
              <span className="text-lg font-bold tabular-nums leading-tight">{Number(j.slice(8))}</span>
              {n > 0 && (
                <span
                  className={cn(
                    "absolute -right-1 -top-1 min-w-4 rounded-full px-1 text-[10px] font-bold leading-4 tabular-nums",
                    actif ? "bg-amber-300 text-amber-950" : "bg-amber-400 text-amber-950",
                  )}
                >
                  {n}
                </span>
              )}
            </button>
          )
        })}
        <button
          onClick={() => setCalendrier(true)}
          aria-label={horsBandeau ? `Calendrier, ${formatJourSemaine(jour)} ${formatJourMoisCourt(jour)} choisi` : "Calendrier"}
          className={cn(
            "flex min-h-14 min-w-0 flex-col items-center justify-center rounded-lg border-2 transition-colors",
            horsBandeau ? "border-primary bg-primary text-primary-foreground" : "border-dashed bg-background",
          )}
        >
          <CalendarDaysIcon className="size-5" />
          {horsBandeau && <span className="text-[10px] font-semibold leading-none">{jour.slice(8)}/{jour.slice(5, 7)}</span>}
        </button>
        {dialogue}
      </div>
    )
  }

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
              "flex min-h-16 min-w-28 flex-1 shrink-0 flex-col items-center justify-center rounded-xl border-2 px-3 transition-colors",
              actif
                ? "border-primary bg-primary text-primary-foreground"
                : "border-transparent bg-muted text-foreground hover:bg-muted/70",
            )}
          >
            <span className="text-lg font-semibold leading-tight">{formatJourSemaine(j)}</span>
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
          "flex min-h-16 min-w-28 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border-2 px-3 transition-colors",
          horsBandeau ? "border-primary bg-primary text-primary-foreground" : "border-dashed bg-background hover:bg-muted",
        )}
      >
        <CalendarDaysIcon className="size-5" />
        <span className="text-base font-semibold leading-tight">
          {horsBandeau ? `${formatJourSemaine(jour).slice(0, 3)}. ${formatJourMoisCourt(jour)}` : "Calendrier"}
        </span>
      </button>
      {dialogue}
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
