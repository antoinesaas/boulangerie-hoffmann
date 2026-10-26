"use client"

import {
  CheckIcon,
  Loader2Icon,
  PrinterIcon,
  StoreIcon,
  TruckIcon,
  Volume2Icon,
  VolumeXIcon,
  WheatIcon,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { BandeauJours, NB_JOURS_BANDEAU } from "@/components/calendrier/BandeauJours"
import { MenuUtilisateur } from "@/components/layout/MenuUtilisateur"
import { BoutonTheme } from "@/components/ThemeProvider"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  aPreparer,
  grouperParDestination,
  productionParDestination,
  recapProduction,
  type Destination,
  type LigneAProduire,
  type ProductionDestination,
} from "@/lib/fornil"
import { changerStatut, useCommandes } from "@/lib/hooks/useCommandes"
import { useProduction } from "@/lib/hooks/useProduction"
import {
  ajouterJours,
  aujourdhui,
  cn,
  formatDate,
  formatJourMoisCourt,
  formatJourSemaine,
  formatQuantite,
  formatUnite,
} from "@/lib/utils"
import {
  type PointDeVente,
  type Role,
  type StatutCommande,
} from "@/types"
import { useSon } from "./son"

interface Props {
  pointsDeVente: Pick<PointDeVente, "id" | "nom">[]
  utilisateur: { nom: string; role: Role }
}

export function VueFornil({ pointsDeVente, utilisateur }: Props) {
  const [jour] = useState(aujourdhui)
  const [jourActif, setJourActif] = useState(jour)
  const son = useSon()

  // La semaine à venir est toujours chargée ; un jour choisi au calendrier élargit la plage.
  const finSemaineAVenir = ajouterJours(jour, NB_JOURS_BANDEAU - 1)
  const dateDebut = jourActif < jour ? jourActif : jour
  const dateFin = jourActif > finSemaineAVenir ? jourActif : finSemaineAVenir

  const { commandes, chargement, erreur, realtime, majLocale, recharger, plageChargee } = useCommandes({
    dateDebut,
    dateFin,
    statuts: ["en_attente", "preparee", "livree"],
  })
  const { pointees, pointer } = useProduction(jourActif)

  useAlerteNouvellesCommandes(commandes, chargement, plageChargee, son.jouer)

  const duJour = useMemo(() => commandes.filter((c) => c.date_livraison === jourActif), [commandes, jourActif])
  const destinations = useMemo(() => grouperParDestination(duJour, pointsDeVente), [duJour, pointsDeVente])
  const production = useMemo(() => productionParDestination(destinations, pointees), [destinations, pointees])
  const lignesProduction = useMemo(() => recapProduction(production), [production])

  const resteProduits = lignesProduction.filter((l) => l.reste > 0)
  const destinationsAPreparer = destinations.filter((d) => aPreparer(d).length > 0)
  const enAttenteParJour = (j: string) =>
    commandes.filter((c) => c.date_livraison === j && c.statut === "en_attente").length

  async function marquer(ids: string[], statut: StatutCommande) {
    ids.forEach((id) => majLocale(id, { statut }))
    const erreurs = (await Promise.all(ids.map((id) => changerStatut(id, statut)))).filter(Boolean)
    if (erreurs.length) {
      toast.error("Mise à jour impossible", { description: erreurs[0]?.message })
      void recharger()
      return false
    }
    return true
  }

  return (
    <div className="flex min-h-dvh flex-col bg-muted/40 print:bg-white">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur print:static print:border-0">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 lg:px-6">
          <WheatIcon className="hidden size-7 sm:block print:hidden" />
          <div className="min-w-0 flex-1 basis-56">
            <h1 className="text-xl font-bold first-letter:uppercase lg:text-2xl">
              <span className="print:hidden">{formatDate(jour)}</span>
              <span className="hidden print:inline">Fornil — {formatDate(jourActif)}</span>
            </h1>
            <p className="flex flex-wrap items-center gap-x-2 text-base text-muted-foreground print:hidden">
              <span
                className={cn(
                  "inline-block size-2.5 rounded-full",
                  realtime === "connecte" ? "bg-emerald-500" : realtime === "connexion" ? "bg-amber-400" : "bg-red-500",
                )}
                title={realtime === "connecte" ? "Temps réel actif" : "Temps réel déconnecté"}
              />
              {formatJourSemaine(jourActif)} {formatJourMoisCourt(jourActif)} ·{" "}
              <strong className="text-foreground tabular-nums">{resteProduits.length}</strong> produit
              {resteProduits.length > 1 ? "s" : ""} à faire ·{" "}
              <strong className="text-foreground tabular-nums">{destinationsAPreparer.length}</strong> magasin
              {destinationsAPreparer.length > 1 ? "s" : ""} à servir
            </p>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <Button
              variant="outline"
              size="icon-lg"
              className="size-12"
              onClick={son.basculer}
              aria-pressed={son.actif}
              aria-label={son.actif ? "Couper le son" : "Activer le son des nouvelles commandes"}
            >
              {son.actif ? <Volume2Icon className="size-5" /> : <VolumeXIcon className="size-5" />}
            </Button>
            <BoutonTheme className="size-12" />
            <Button variant="outline" className="h-12 px-4 text-base" onClick={() => window.print()}>
              <PrinterIcon className="size-5" /> <span className="hidden sm:inline">Imprimer</span>
            </Button>
            <MenuUtilisateur nom={utilisateur.nom} role={utilisateur.role} />
          </div>
        </div>

        <div className="px-4 pb-3 lg:px-6 print:hidden">
          <BandeauJours grand jour={jourActif} surChoix={setJourActif} enAttente={enAttenteParJour} />
        </div>
      </header>

      <main className="flex-1 px-4 py-6 lg:px-6">
        {erreur && <p className="mb-4 rounded-xl bg-destructive/10 p-4 text-lg text-destructive">{erreur}</p>}

        {chargement ? (
          <div className="flex justify-center py-20">
            <Loader2Icon className="size-10 animate-spin text-muted-foreground" />
          </div>
        ) : duJour.length === 0 ? (
          <p className="py-20 text-center text-2xl text-muted-foreground">Aucune commande pour ce jour.</p>
        ) : (
          <OngletProduire recap={lignesProduction} production={production} pointer={pointer} marquer={marquer} />
        )}
      </main>
    </div>
  )
}

/** Toast + son quand une commande arrive (hors changement de jour ou de plage). */
function useAlerteNouvellesCommandes(
  commandes: { id: string; date_livraison: string }[],
  chargement: boolean,
  plage: string,
  jouer: () => void,
) {
  const connues = useRef<Set<string> | null>(null)
  const plageConnue = useRef("")
  useEffect(() => {
    if (chargement) return
    if (connues.current === null || plageConnue.current !== plage) {
      plageConnue.current = plage
      connues.current = new Set(commandes.map((c) => c.id))
      return
    }
    const arrivees = commandes.filter((c) => !connues.current!.has(c.id))
    if (arrivees.length === 0) return
    arrivees.forEach((c) => connues.current!.add(c.id))
    jouer()
    const c = arrivees[0]
    toast.info(
      arrivees.length > 1
        ? `${arrivees.length} nouvelles commandes`
        : `Nouvelle commande pour ${formatJourSemaine(c.date_livraison).toLowerCase()} ${formatJourMoisCourt(c.date_livraison)}`,
    )
  }, [commandes, chargement, plage, jouer])
}

type Pointer = (destination: string, produitId: string, quantite: number) => Promise<unknown>
type Marquer = (ids: string[], statut: StatutCommande) => Promise<boolean>

/**
 * Onglet « À produire » : en haut le bandeau du total restant (tous magasins),
 * puis une carte par magasin / client livré avec ses quantités et un bouton « Fini » par produit.
 */
function OngletProduire({
  recap,
  production,
  pointer,
  marquer,
}: {
  recap: LigneAProduire[]
  production: ProductionDestination[]
  pointer: Pointer
  marquer: Marquer
}) {
  const [partiel, setPartiel] = useState<{ destination: Destination; ligne: LigneAProduire } | null>(null)
  const boutiques = production.filter((p) => !p.destination.livraison)
  const livraisons = production.filter((p) => p.destination.livraison)

  /** Valide une ligne ; si c'était la dernière du magasin, l'envoi passe « prêt » tout seul. */
  async function valider(p: ProductionDestination, l: LigneAProduire, quantite: number) {
    const avant = l.faite
    await pointer(p.destination.cle, l.produit_id, quantite)
    const finiAussi = quantite >= l.total && p.lignes.every((x) => x.produit_id === l.produit_id || x.reste <= 0)
    const ids = finiAussi ? aPreparer(p.destination).map((c) => c.id) : []
    if (ids.length) await marquer(ids, "preparee")
    toast.success(
      finiAussi ? `${p.destination.nom} : tout est prêt` : `${p.destination.nom} : ${formatQuantite(quantite - avant)} ${l.nom}`,
      {
        action: {
          label: "Annuler",
          onClick: () => {
            void pointer(p.destination.cle, l.produit_id, avant)
            if (ids.length) void marquer(ids, "en_attente")
          },
        },
      },
    )
  }

  return (
    <div className="space-y-6">
      <BandeauTotal recap={recap} />

      {[
        { titre: "Magasins", Icone: StoreIcon, liste: boutiques },
        { titre: "Livraisons", Icone: TruckIcon, liste: livraisons },
      ].map(({ titre, Icone, liste }) =>
        liste.length === 0 ? null : (
          <section key={titre} className="space-y-3">
            <h2 className="flex items-center gap-2 text-2xl font-bold">
              <Icone className="size-6" /> {titre}
            </h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 print:block print:space-y-3">
              {liste.map((p) => (
                <CarteProduction
                  key={p.destination.cle}
                  production={p}
                  surFini={(l) => void valider(p, l, l.total)}
                  surPartiel={(l) => setPartiel({ destination: p.destination, ligne: l })}
                  surRemettre={(l) => void pointer(p.destination.cle, l.produit_id, 0)}
                />
              ))}
            </div>
          </section>
        ),
      )}

      <DialogPartiel
        ligne={partiel?.ligne ?? null}
        titre={partiel ? `${partiel.ligne.nom} — ${partiel.destination.nom}` : ""}
        surFermer={() => setPartiel(null)}
        surValider={(n) => {
          const p = production.find((x) => x.destination.cle === partiel?.destination.cle)
          if (p && partiel) void valider(p, partiel.ligne, Math.min(partiel.ligne.total, partiel.ligne.faite + n))
          setPartiel(null)
        }}
      />
    </div>
  )
}

/** Bandeau du haut : ce qu'il reste à produire au total, tous magasins confondus. */
function BandeauTotal({ recap }: { recap: LigneAProduire[] }) {
  const restant = recap.filter((l) => l.reste > 0)
  if (restant.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-emerald-500/40 bg-emerald-50 p-6 text-center text-2xl font-semibold text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
        <CheckIcon className="mx-auto mb-2 size-9" /> Tout est produit pour ce jour.
      </div>
    )
  }
  return (
    <section className="rounded-2xl border-2 bg-card p-4 print:break-after-page">
      <h2 className="mb-3 text-base font-bold uppercase tracking-wide text-muted-foreground sm:text-lg">
        Reste à produire — total (reste / commandé)
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {recap.map((l) => (
          <div key={l.produit_id} className={cn("rounded-xl bg-muted/60 p-3", l.reste <= 0 && "opacity-40")}>
            <div className="whitespace-nowrap text-3xl font-black tabular-nums leading-none sm:text-4xl">
              {l.reste <= 0 ? <CheckIcon className="inline size-8 text-emerald-600" /> : formatQuantite(l.reste)}
              <span className="text-base font-semibold text-muted-foreground sm:text-lg"> / {formatQuantite(l.total)}</span>
            </div>
            <div className="mt-1 text-base font-medium leading-tight">
              {l.nom}
              {l.unite !== "pièce" && <span className="text-muted-foreground"> ({formatUnite(l.unite)})</span>}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

/** Carte d'un magasin : quantités à produire pour lui (commandes + habituelle), validables ligne par ligne. */
function CarteProduction({
  production,
  surFini,
  surPartiel,
  surRemettre,
}: {
  production: ProductionDestination
  surFini: (l: LigneAProduire) => void
  surPartiel: (l: LigneAProduire) => void
  surRemettre: (l: LigneAProduire) => void
}) {
  const { destination, lignes } = production
  const restantes = lignes.filter((l) => l.reste > 0)
  const finies = lignes.filter((l) => l.reste <= 0)
  const notes = aPreparer(destination).filter((c) => c.notes)

  if (restantes.length === 0) {
    return (
      <article className="flex items-center gap-3 rounded-2xl border-2 border-emerald-500/40 bg-emerald-50/60 p-4 dark:bg-emerald-950/30 print:hidden">
        <CheckIcon className="size-7 shrink-0 text-emerald-600" />
        <div className="min-w-0 flex-1">
          <div className="text-xl font-semibold">{destination.nom} · tout est prêt</div>
          <div className="truncate text-sm text-muted-foreground">
            {finies.map((l) => `${formatQuantite(l.total)} ${l.nom}`).join(" · ")}
          </div>
        </div>
      </article>
    )
  }

  return (
    <article className="carte-fornil flex flex-col rounded-2xl border-2 bg-card p-4 shadow-sm">
      <header className="mb-2 flex items-baseline justify-between gap-3">
        <h3 className="text-2xl font-bold">{destination.nom}</h3>
        {destination.livraison && destination.commandes[0]?.point_de_vente && (
          <span className="text-sm text-muted-foreground">via {destination.commandes[0].point_de_vente.nom}</span>
        )}
      </header>

      <ul className="divide-y">
        {restantes.map((l) => (
          <li key={l.produit_id} className="flex items-center gap-3 py-2">
            <button
              onClick={() => surPartiel(l)}
              className="min-w-16 text-right text-4xl font-black tabular-nums leading-none"
              aria-label={`${formatQuantite(l.reste)} ${l.nom} à faire pour ${destination.nom}. Indiquer une partie faite`}
            >
              {formatQuantite(l.reste)}
            </button>
            <div className="min-w-0 flex-1">
              <div className="text-xl font-semibold leading-tight">{l.nom}</div>
              {l.faite > 0 && (
                <div className="text-sm text-muted-foreground">
                  {formatQuantite(l.faite)} déjà faits sur {formatQuantite(l.total)}
                </div>
              )}
            </div>
            <Button
              onClick={() => surFini(l)}
              className="h-14 shrink-0 rounded-xl bg-emerald-600 px-4 text-lg font-bold text-white hover:bg-emerald-700 print:hidden"
              aria-label={`${l.nom} fini pour ${destination.nom}`}
            >
              <CheckIcon className="size-6 stroke-[3]" /> Fini
            </Button>
          </li>
        ))}
      </ul>

      {notes.length > 0 && (
        <ul className="mt-3 space-y-1 rounded-lg bg-amber-100/70 px-3 py-2 text-base text-amber-950 dark:bg-amber-500/15 dark:text-amber-100">
          {notes.map((c) => (
            <li key={c.id} className="italic">
              {c.notes}
              {!destination.livraison && c.client && <span className="not-italic opacity-70"> — {c.client.nom}</span>}
            </li>
          ))}
        </ul>
      )}

      {finies.length > 0 && (
        <p className="mt-3 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground print:hidden">
          <CheckIcon className="size-4 text-emerald-600" /> Fini :
          {finies.map((l) => (
            <button
              key={l.produit_id}
              onClick={() => surRemettre(l)}
              className="underline decoration-dotted underline-offset-4"
              title="Remettre à faire"
            >
              {formatQuantite(l.total)} {l.nom}
            </button>
          ))}
        </p>
      )}
    </article>
  )
}

/** « J'en ai fait X » : avance le décompte d'une partie seulement. */
function DialogPartiel({
  ligne,
  titre,
  surFermer,
  surValider,
}: {
  ligne: LigneAProduire | null
  titre?: string
  surFermer: () => void
  surValider: (quantite: number) => void
}) {
  const [texte, setTexte] = useState("")
  const n = Number(texte.replace(",", "."))
  const valide = Number.isFinite(n) && n > 0

  return (
    <Dialog
      open={ligne !== null}
      onOpenChange={(o) => {
        if (!o) {
          setTexte("")
          surFermer()
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl">{titre || ligne?.nom}</DialogTitle>
        </DialogHeader>
        <p className="text-lg">
          Reste <strong>{ligne ? formatQuantite(ligne.reste) : ""}</strong> à faire. Combien viennent d&apos;être faits ?
        </p>
        <input
          inputMode="decimal"
          autoFocus
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          className="h-16 w-full rounded-xl border bg-background text-center text-4xl font-bold tabular-nums outline-none focus:ring-2 focus:ring-ring"
          aria-label="Quantité faite"
        />
        <div className="grid grid-cols-4 gap-2">
          {[5, 10, 20, 50].map((q) => (
            <Button key={q} variant="outline" className="h-12 text-lg" onClick={() => setTexte(String(q))}>
              {q}
            </Button>
          ))}
        </div>
        <DialogFooter>
          <Button
            className="h-14 w-full text-lg"
            disabled={!valide}
            onClick={() => {
              surValider(n)
              setTexte("")
            }}
          >
            Valider
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
