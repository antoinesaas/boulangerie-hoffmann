"use client"

import {
  CheckIcon,
  ClipboardListIcon,
  Loader2Icon,
  PrinterIcon,
  RepeatIcon,
  StoreIcon,
  TruckIcon,
  Undo2Icon,
  Volume2Icon,
  VolumeXIcon,
  WheatIcon,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { BandeauJours, NB_JOURS_BANDEAU } from "@/components/calendrier/BandeauJours"
import { MenuUtilisateur } from "@/components/layout/MenuUtilisateur"
import { BoutonTheme } from "@/components/ThemeProvider"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { aPreparer, aProduire, grouperParDestination, sommeProduits, type Destination, type LigneAProduire } from "@/lib/fornil"
import { changerStatut, useCommandes } from "@/lib/hooks/useCommandes"
import { useProduction } from "@/lib/hooks/useProduction"
import { useRealtime } from "@/lib/hooks/useRealtime"
import { createClient } from "@/lib/supabase/client"
import {
  ajouterJours,
  aujourdhui,
  cn,
  formatDate,
  formatJourMoisCourt,
  formatJourSemaine,
  formatQuantite,
  formatUnite,
  jourSemaineIso,
} from "@/lib/utils"
import {
  NOMS_JOURS_SEMAINE,
  type CommandeRecurrenteDetail,
  type PointDeVente,
  type Produit,
  type Role,
  type StatutCommande,
} from "@/types"
import { useSon } from "./son"

interface Props {
  pointsDeVente: Pick<PointDeVente, "id" | "nom">[]
  produits: Pick<Produit, "id" | "nom" | "unite" | "ordre">[]
  utilisateur: { nom: string; role: Role }
}

type Onglet = "produire" | "expeditions" | "habituelles"

export function VueFornil({ pointsDeVente, produits, utilisateur }: Props) {
  const [jour] = useState(aujourdhui)
  const [jourActif, setJourActif] = useState(jour)
  const [onglet, setOnglet] = useState<Onglet>("produire")
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
  const lignesProduction = useMemo(() => aProduire(duJour, pointees), [duJour, pointees])
  const destinations = useMemo(() => grouperParDestination(duJour, pointsDeVente), [duJour, pointsDeVente])

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
          <WheatIcon className="size-7 print:hidden" />
          <div className="min-w-0 flex-1">
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
              <strong className="text-foreground tabular-nums">{destinationsAPreparer.length}</strong> envoi
              {destinationsAPreparer.length > 1 ? "s" : ""} à préparer
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

        <div className="space-y-3 px-4 pb-3 lg:px-6 print:hidden">
          <BandeauJours grand jour={jourActif} surChoix={setJourActif} enAttente={enAttenteParJour} />
          <div className="grid grid-cols-3 gap-2" role="tablist">
            {(
              [
                ["produire", "À produire", ClipboardListIcon, resteProduits.length],
                ["expeditions", "Envois", TruckIcon, destinationsAPreparer.length],
                ["habituelles", "Habituelles", RepeatIcon, null],
              ] as const
            ).map(([valeur, libelle, Icone, compte]) => (
              <button
                key={valeur}
                role="tab"
                aria-selected={onglet === valeur}
                onClick={() => setOnglet(valeur)}
                className={cn(
                  "flex min-h-14 items-center justify-center gap-2 rounded-xl border-2 text-lg font-semibold transition-colors",
                  onglet === valeur ? "border-foreground bg-foreground text-background" : "border-border bg-background",
                )}
              >
                <Icone className="size-5" /> {libelle}
                {compte !== null && compte > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-2 text-base tabular-nums",
                      onglet === valeur ? "bg-background/20" : "bg-amber-200 text-amber-950",
                    )}
                  >
                    {compte}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 lg:px-6">
        {erreur && <p className="mb-4 rounded-xl bg-destructive/10 p-4 text-lg text-destructive">{erreur}</p>}

        {onglet === "habituelles" ? (
          <OngletHabituelles produits={produits} jourMisEnAvant={jourSemaineIso(jourActif)} />
        ) : chargement ? (
          <div className="flex justify-center py-20">
            <Loader2Icon className="size-10 animate-spin text-muted-foreground" />
          </div>
        ) : duJour.length === 0 ? (
          <p className="py-20 text-center text-2xl text-muted-foreground">Aucune commande pour ce jour.</p>
        ) : onglet === "produire" ? (
          <OngletProduire lignes={lignesProduction} pointer={pointer} />
        ) : (
          <OngletEnvois destinations={destinations} marquer={marquer} />
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

/** Onglet « À produire » : une ligne par produit, le décompte, un bouton « Fait ». */
function OngletProduire({
  lignes,
  pointer,
}: {
  lignes: LigneAProduire[]
  pointer: (produitId: string, quantite: number) => Promise<unknown>
}) {
  const [voirFaits, setVoirFaits] = useState(false)
  const [partiel, setPartiel] = useState<LigneAProduire | null>(null)
  const restants = lignes.filter((l) => l.reste > 0)
  const faits = lignes.filter((l) => l.reste <= 0)

  function toutFait(l: LigneAProduire) {
    void pointer(l.produit_id, l.total)
    toast.success(`${l.nom} : fait`, {
      action: { label: "Annuler", onClick: () => void pointer(l.produit_id, l.faite) },
    })
  }

  return (
    <div className="mx-auto max-w-4xl space-y-3">
      {restants.length === 0 ? (
        <div className="rounded-2xl border-2 border-emerald-500/40 bg-emerald-50 p-8 text-center text-2xl font-semibold text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
          <CheckIcon className="mx-auto mb-2 size-10" /> Tout est produit pour ce jour.
        </div>
      ) : (
        <ul className="space-y-3">
          {restants.map((l) => (
            <li
              key={l.produit_id}
              className="carte-fornil flex items-center gap-4 rounded-2xl border-2 bg-card p-4 shadow-sm"
            >
              <button
                onClick={() => setPartiel(l)}
                className="min-w-28 text-right text-5xl font-black tabular-nums leading-none"
                aria-label={`${formatQuantite(l.reste)} ${l.nom} à faire. Indiquer une partie faite`}
              >
                {formatQuantite(l.reste)}
              </button>
              <div className="min-w-0 flex-1">
                <div className="text-2xl font-semibold leading-tight">{l.nom}</div>
                <div className="text-base text-muted-foreground">
                  {l.unite !== "pièce" ? `${formatUnite(l.unite, l.reste)} · ` : ""}
                  {l.faite > 0
                    ? `${formatQuantite(l.faite)} déjà faits sur ${formatQuantite(l.total)}`
                    : `sur ${formatQuantite(l.total)} commandés`}
                </div>
              </div>
              <Button
                onClick={() => toutFait(l)}
                className="h-16 shrink-0 rounded-xl bg-emerald-600 px-6 text-xl font-bold text-white hover:bg-emerald-700 print:hidden"
              >
                <CheckIcon className="size-7 stroke-[3]" /> Fait
              </Button>
            </li>
          ))}
        </ul>
      )}

      {faits.length > 0 && (
        <div className="pt-2 print:hidden">
          <button
            onClick={() => setVoirFaits((v) => !v)}
            className="min-h-11 text-base text-muted-foreground underline underline-offset-4"
          >
            {voirFaits ? "Masquer" : "Afficher"} les produits terminés ({faits.length})
          </button>
          {voirFaits && (
            <ul className="mt-2 space-y-2">
              {faits.map((l) => (
                <li key={l.produit_id} className="flex items-center gap-3 rounded-xl bg-muted/60 px-4 py-2 text-lg">
                  <CheckIcon className="size-5 text-emerald-600" />
                  <span className="flex-1">
                    {formatQuantite(l.total)} {l.nom}
                  </span>
                  <Button variant="ghost" onClick={() => void pointer(l.produit_id, 0)}>
                    <Undo2Icon /> Remettre
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <DialogPartiel
        ligne={partiel}
        surFermer={() => setPartiel(null)}
        surValider={(n) => {
          if (partiel) void pointer(partiel.produit_id, partiel.faite + n)
          setPartiel(null)
        }}
      />
    </div>
  )
}

/** « J'en ai fait X » : avance le décompte d'une partie seulement. */
function DialogPartiel({
  ligne,
  surFermer,
  surValider,
}: {
  ligne: LigneAProduire | null
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
          <DialogTitle className="text-2xl">{ligne?.nom}</DialogTitle>
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

/** Onglet « Envois » : par boutique ou client livré, les quantités à envoyer et un seul bouton « Prêt ». */
function OngletEnvois({
  destinations,
  marquer,
}: {
  destinations: Destination[]
  marquer: (ids: string[], statut: StatutCommande) => Promise<boolean>
}) {
  const boutiques = destinations.filter((d) => !d.livraison)
  const livraisons = destinations.filter((d) => d.livraison)

  return (
    <div className="space-y-8">
      {boutiques.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-2xl font-bold">
            <StoreIcon className="size-6" /> Boutiques
          </h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 print:block print:space-y-3">
            {boutiques.map((d) => (
              <CarteEnvoi key={d.cle} destination={d} marquer={marquer} />
            ))}
          </div>
        </section>
      )}
      {livraisons.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-2xl font-bold">
            <TruckIcon className="size-6" /> Livraisons
          </h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 print:block print:space-y-3">
            {livraisons.map((d) => (
              <CarteEnvoi key={d.cle} destination={d} marquer={marquer} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function CarteEnvoi({
  destination,
  marquer,
}: {
  destination: Destination
  marquer: (ids: string[], statut: StatutCommande) => Promise<boolean>
}) {
  const [enCours, setEnCours] = useState(false)
  const [dernierEnvoi, setDernierEnvoi] = useState<string[]>([])
  const restantes = aPreparer(destination)
  const produits = sommeProduits(restantes)
  const notes = restantes.filter((c) => c.notes)

  async function valider() {
    const ids = restantes.map((c) => c.id)
    setEnCours(true)
    if (await marquer(ids, "preparee")) {
      setDernierEnvoi(ids)
      toast.success(`${destination.nom} : prêt`)
    }
    setEnCours(false)
  }

  if (restantes.length === 0) {
    return (
      <article className="flex items-center gap-3 rounded-2xl border-2 border-emerald-500/40 bg-emerald-50/60 p-4 opacity-80 dark:bg-emerald-950/30 print:hidden">
        <CheckIcon className="size-7 text-emerald-600" />
        <span className="flex-1 text-xl font-semibold">{destination.nom} · prêt</span>
        {dernierEnvoi.length > 0 && (
          <Button
            variant="ghost"
            onClick={async () => {
              if (await marquer(dernierEnvoi, "en_attente")) setDernierEnvoi([])
            }}
          >
            <Undo2Icon /> Annuler
          </Button>
        )}
      </article>
    )
  }

  return (
    <article className="carte-fornil flex flex-col rounded-2xl border-2 bg-card p-4 shadow-sm">
      <header className="flex items-baseline justify-between gap-3">
        <h3 className="text-2xl font-bold">{destination.nom}</h3>
        {destination.livraison && destination.commandes[0]?.point_de_vente && (
          <span className="text-sm text-muted-foreground">via {destination.commandes[0].point_de_vente.nom}</span>
        )}
      </header>
      <ul className="my-4 flex-1 space-y-1.5">
        {produits.map((p) => (
          <li key={p.produit_id} className="flex items-baseline gap-3">
            <span className="min-w-16 text-right text-3xl font-black tabular-nums leading-none">
              {formatQuantite(p.quantite)}
            </span>
            <span className="text-xl font-medium leading-tight">
              {p.nom}
              {p.unite !== "pièce" && (
                <span className="text-base text-muted-foreground"> {formatUnite(p.unite, p.quantite)}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
      {notes.length > 0 && (
        <ul className="mb-4 space-y-1 rounded-lg bg-amber-100/70 px-3 py-2 text-base text-amber-950 dark:bg-amber-500/15 dark:text-amber-100">
          {notes.map((c) => (
            <li key={c.id} className="italic">
              {c.notes}
              {!destination.livraison && c.client && <span className="not-italic opacity-70"> — {c.client.nom}</span>}
            </li>
          ))}
        </ul>
      )}
      <Button
        onClick={() => void valider()}
        disabled={enCours}
        className="h-16 w-full rounded-xl bg-emerald-600 text-xl font-bold text-white hover:bg-emerald-700 print:hidden"
      >
        {enCours ? <Loader2Icon className="size-6 animate-spin" /> : <CheckIcon className="size-7 stroke-[3]" />}
        {destination.nom} prêt
      </Button>
    </article>
  )
}

/** Onglet « Habituelles » : ce que chaque boutique / client reçoit chaque semaine. */
function OngletHabituelles({
  produits,
  jourMisEnAvant,
}: {
  produits: Props["produits"]
  jourMisEnAvant: number
}) {
  const [liste, setListe] = useState<CommandeRecurrenteDetail[] | null>(null)
  const parId = useMemo(() => new Map(produits.map((p) => [p.id, p])), [produits])

  const charger = useCallback(async () => {
    const { data } = await createClient()
      .from("commandes_recurrentes")
      .select("*, client:clients(id, nom, type), point_de_vente:points_de_vente(id, nom)")
      .eq("actif", true)
    setListe((data ?? []) as CommandeRecurrenteDetail[])
  }, [])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void charger()
  }, [charger])
  useRealtime(["commandes_recurrentes"], charger)

  if (liste === null) {
    return (
      <div className="flex justify-center py-20">
        <Loader2Icon className="size-10 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (liste.length === 0) {
    return <p className="py-20 text-center text-2xl text-muted-foreground">Aucune commande habituelle.</p>
  }

  // Le jour affiché d'abord, puis la suite de la semaine.
  const jours = [0, 1, 2, 3, 4, 5, 6].map((i) => ((jourMisEnAvant - 1 + i) % 7) + 1)

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {jours.map((j) => {
        const duJour = liste.filter((h) => h.jour_semaine === j)
        if (duJour.length === 0) return null
        return (
          <section key={j} className="space-y-2">
            <h2 className="text-2xl font-bold">
              Chaque {NOMS_JOURS_SEMAINE[j]}
              {j === jourMisEnAvant && <span className="ml-2 text-base font-normal text-muted-foreground">(jour affiché)</span>}
            </h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {duJour.map((h) => (
                <article key={h.id} className="rounded-2xl border bg-card p-4">
                  <h3 className="text-xl font-semibold">{h.client?.nom ?? h.point_de_vente?.nom}</h3>
                  {h.client && h.client.type !== "point_de_vente" && h.point_de_vente && (
                    <p className="text-sm text-muted-foreground">via {h.point_de_vente.nom}</p>
                  )}
                  <ul className="mt-2 space-y-0.5 text-lg">
                    {[...h.lignes]
                      .sort((a, b) => (parId.get(a.produit_id)?.ordre ?? 0) - (parId.get(b.produit_id)?.ordre ?? 0))
                      .map((l) => (
                      <li key={l.produit_id}>
                        <strong className="tabular-nums">{formatQuantite(l.quantite)}</strong>{" "}
                        {parId.get(l.produit_id)?.nom ?? "Produit"}
                      </li>
                      ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
