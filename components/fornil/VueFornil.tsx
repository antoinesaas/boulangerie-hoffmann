"use client"

import { Loader2Icon, PrinterIcon, TruckIcon, Volume2Icon, VolumeXIcon, WheatIcon } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { MenuUtilisateur } from "@/components/layout/MenuUtilisateur"
import { BoutonTheme } from "@/components/ThemeProvider"
import { Button } from "@/components/ui/button"
import { changerStatut, useCommandes } from "@/lib/hooks/useCommandes"
import { ajouterJours, aujourdhui, cn, formatDate, formatQuantite, formatUnite, libelleJour } from "@/lib/utils"
import { TYPES_LIVRAISON, type CommandeDetail, type PointDeVente, type Role, type StatutCommande } from "@/types"
import { CarteFornil } from "./CarteFornil"

interface Props {
  pointsDeVente: Pick<PointDeVente, "id" | "nom">[]
  utilisateur: { nom: string; role: Role }
}

interface Section {
  cle: string
  titre: string
  icone: "pdv" | "livraison"
  commandes: CommandeDetail[]
}

const ORDRE_STATUT: Record<StatutCommande, number> = { en_attente: 0, preparee: 1, livree: 2, annulee: 3 }
const DUREE_NOUVELLE_MS = 15_000
const CLE_SON = "bg:fornil:son"

export function VueFornil({ pointsDeVente, utilisateur }: Props) {
  const [jour] = useState(aujourdhui)
  const jours = useMemo(() => [0, 1, 2, 3].map((n) => ajouterJours(jour, n)), [jour])
  const [jourActif, setJourActif] = useState(jours[0])
  const [enCours, setEnCours] = useState<Set<string>>(new Set())
  const [nouvelles, setNouvelles] = useState<Map<string, number>>(new Map())
  const son = useSon()

  const { commandes, chargement, erreur, realtime, majLocale } = useCommandes({
    dateDebut: jours[0],
    dateFin: jours[3],
    statuts: ["en_attente", "preparee", "livree"],
  })

  // Repère les commandes arrivées depuis le premier chargement (animation + son).
  const connues = useRef<Set<string> | null>(null)
  useEffect(() => {
    if (chargement) return
    if (connues.current === null) {
      connues.current = new Set(commandes.map((c) => c.id))
      return
    }
    const arrivees = commandes.filter((c) => !connues.current!.has(c.id))
    if (arrivees.length === 0) return
    arrivees.forEach((c) => connues.current!.add(c.id))
    const maintenant = Date.now()
     
    setNouvelles((m) => {
      const suivante = new Map(m)
      arrivees.forEach((c) => suivante.set(c.id, maintenant))
      return suivante
    })
    son.jouer()
    const premiere = arrivees[0]
    toast.info(
      arrivees.length > 1
        ? `${arrivees.length} nouvelles commandes`
        : `Nouvelle commande : ${premiere.client?.nom ?? ""} (${libelleJour(premiere.date_livraison, jour)})`,
    )
  }, [commandes, chargement, son, jour])

  useEffect(() => {
    if (nouvelles.size === 0) return
    const minuteur = setTimeout(() => {
      const limite = Date.now() - DUREE_NOUVELLE_MS
      setNouvelles((m) => new Map([...m].filter(([, t]) => t > limite)))
    }, 1_000)
    return () => clearTimeout(minuteur)
  }, [nouvelles])

  const duJour = commandes.filter((c) => c.date_livraison === jourActif)
  const enAttenteParJour = (j: string) => commandes.filter((c) => c.date_livraison === j && c.statut === "en_attente").length
  const enAttente = enAttenteParJour(jourActif)

  const sections = useMemo(() => construireSections(duJour, pointsDeVente), [duJour, pointsDeVente])
  const recap = useMemo(() => recapProduction(duJour), [duJour])

  async function basculer(c: CommandeDetail, statut: StatutCommande) {
    const precedent = c.statut
    setEnCours((s) => new Set(s).add(c.id))
    majLocale(c.id, { statut })
    const err = await changerStatut(c.id, statut)
    setEnCours((s) => {
      const suivant = new Set(s)
      suivant.delete(c.id)
      return suivant
    })
    if (err) {
      majLocale(c.id, { statut: precedent })
      toast.error("Mise à jour impossible", { description: err.message })
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-muted/40 print:bg-white">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur print:static print:border-0">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 lg:px-6">
          <WheatIcon className="size-7 print:hidden" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold first-letter:uppercase lg:text-2xl">
              <span className="print:hidden">{formatDate(jour)}</span>
              <span className="hidden print:inline">Commandes — {formatDate(jourActif)}</span>
            </h1>
            <p className="flex items-center gap-2 text-base text-muted-foreground print:hidden">
              <span
                className={cn(
                  "inline-block size-2.5 rounded-full",
                  realtime === "connecte" ? "bg-emerald-500" : realtime === "connexion" ? "bg-amber-400" : "bg-red-500",
                )}
                title={realtime === "connecte" ? "Temps réel actif" : "Temps réel déconnecté"}
              />
              <strong className="text-foreground tabular-nums">{enAttente}</strong>
              commande{enAttente > 1 ? "s" : ""} en attente · {libelleJour(jourActif, jour)}
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
              title={son.actif ? "Son activé" : "Son coupé"}
            >
              {son.actif ? <Volume2Icon className="size-5" /> : <VolumeXIcon className="size-5" />}
            </Button>
            <BoutonTheme className="size-12" />
            <Button variant="outline" className="h-12 px-4 text-base" onClick={() => window.print()}>
              <PrinterIcon className="size-5" /> <span className="hidden sm:inline">Voir tout en print</span>
            </Button>
            <MenuUtilisateur nom={utilisateur.nom} role={utilisateur.role} />
          </div>
        </div>

        <nav className="grid grid-cols-4 gap-2 px-4 pb-3 lg:px-6 print:hidden" role="tablist">
          {jours.map((j, i) => {
            const n = enAttenteParJour(j)
            return (
              <button
                key={j}
                role="tab"
                aria-selected={jourActif === j}
                onClick={() => setJourActif(j)}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center rounded-xl border-2 px-2 text-lg font-semibold transition-colors",
                  jourActif === j
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-transparent bg-muted text-foreground hover:bg-muted/70",
                )}
              >
                <span>{i === 0 ? "Aujourd'hui" : i === 1 ? "Demain" : `J+${i}`}</span>
                <span className={cn("text-sm font-normal", jourActif === j ? "opacity-80" : "text-muted-foreground")}>
                  {n > 0 ? `${n} en attente` : libelleJour(j, jour)}
                </span>
              </button>
            )
          })}
        </nav>
      </header>

      <main className="flex-1 space-y-8 px-4 py-6 lg:px-6">
        {erreur && <p className="rounded-xl bg-destructive/10 p-4 text-lg text-destructive">{erreur}</p>}

        {chargement ? (
          <div className="flex justify-center py-20">
            <Loader2Icon className="size-10 animate-spin text-muted-foreground" />
          </div>
        ) : duJour.length === 0 ? (
          <p className="py-20 text-center text-2xl text-muted-foreground">Aucune commande pour ce jour.</p>
        ) : (
          <>
            <RecapProduction recap={recap} />
            {sections.map((section) => (
              <section key={section.cle} className="section-fornil space-y-3">
                <h2 className="flex items-center gap-2 border-b-2 border-foreground/10 pb-2 text-2xl font-bold">
                  {section.icone === "livraison" && <TruckIcon className="size-6" />}
                  {section.titre}
                  <span className="text-lg font-normal text-muted-foreground">
                    · {section.commandes.filter((c) => c.statut === "en_attente").length} en attente /{" "}
                    {section.commandes.length}
                  </span>
                </h2>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 print:block print:space-y-3">
                  {section.commandes.map((c) => (
                    <CarteFornil
                      key={c.id}
                      commande={c}
                      nouvelle={nouvelles.has(c.id)}
                      enCours={enCours.has(c.id)}
                      afficherPointDeVente={section.icone === "livraison"}
                      surPreparee={() => void basculer(c, "preparee")}
                      surAnnulerPreparee={() => void basculer(c, "en_attente")}
                    />
                  ))}
                </div>
              </section>
            ))}
          </>
        )}
      </main>
    </div>
  )
}

function construireSections(commandes: CommandeDetail[], pointsDeVente: Pick<PointDeVente, "id" | "nom">[]): Section[] {
  const tri = (a: CommandeDetail, b: CommandeDetail) =>
    ORDRE_STATUT[a.statut] - ORDRE_STATUT[b.statut] || a.cree_le.localeCompare(b.cree_le)
  const estLivraison = (c: CommandeDetail) => Boolean(c.client && TYPES_LIVRAISON.includes(c.client.type))

  const sections: Section[] = pointsDeVente.map((p) => ({
    cle: p.id,
    titre: p.nom,
    icone: "pdv" as const,
    commandes: commandes.filter((c) => !estLivraison(c) && c.point_de_vente_id === p.id).sort(tri),
  }))
  const connus = new Set(pointsDeVente.map((p) => p.id))
  const orphelines = commandes.filter((c) => !estLivraison(c) && !connus.has(c.point_de_vente_id ?? ""))
  if (orphelines.length) {
    sections.push({ cle: "autres", titre: "Autres", icone: "pdv", commandes: orphelines.sort(tri) })
  }
  sections.push({
    cle: "livraisons",
    titre: "Livraisons",
    icone: "livraison",
    commandes: commandes.filter(estLivraison).sort(tri),
  })
  return sections.filter((s) => s.commandes.length > 0)
}

interface LigneRecap {
  nom: string
  unite: string
  total: number
  reste: number
}

function recapProduction(commandes: CommandeDetail[]): LigneRecap[] {
  const parProduit = new Map<string, LigneRecap & { ordre: number }>()
  for (const c of commandes) {
    for (const l of c.lignes) {
      const id = l.produit_id
      const ligne = parProduit.get(id) ?? {
        nom: l.produit?.nom ?? "?",
        unite: l.produit?.unite ?? "pièce",
        ordre: l.produit?.ordre ?? 0,
        total: 0,
        reste: 0,
      }
      ligne.total += Number(l.quantite)
      if (c.statut === "en_attente") ligne.reste += Number(l.quantite)
      parProduit.set(id, ligne)
    }
  }
  return [...parProduit.values()].sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom, "fr"))
}

function RecapProduction({ recap }: { recap: LigneRecap[] }) {
  if (recap.length === 0) return null
  return (
    <section className="rounded-2xl border-2 bg-card p-4 print:break-after-page">
      <h2 className="mb-3 text-lg font-bold uppercase tracking-wide text-muted-foreground">À produire (reste / total)</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {recap.map((r) => (
          <div key={r.nom} className={cn("rounded-xl bg-muted/60 p-3", r.reste === 0 && "opacity-50")}>
            <div className="text-3xl font-black tabular-nums leading-none">
              {formatQuantite(r.reste)}
              <span className="text-lg font-semibold text-muted-foreground"> / {formatQuantite(r.total)}</span>
            </div>
            <div className="mt-1 text-base font-medium leading-tight">
              {r.nom}
              {r.unite !== "pièce" && <span className="text-muted-foreground"> ({formatUnite(r.unite)})</span>}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

/** Petit carillon Web Audio (aucun fichier son). Préférence mémorisée sur l'appareil. */
function useSon() {
  const [actif, setActif] = useState(false)
  const contexte = useRef<AudioContext | null>(null)

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(CLE_SON) === "1") setActif(true)
    } catch {
      // Stockage indisponible : son coupé par défaut.
    }
  }, [])

  // Les navigateurs exigent un geste utilisateur avant de jouer du son.
  useEffect(() => {
    if (!actif) return
    const deverrouiller = () => {
      contexte.current ??= new AudioContext()
      void contexte.current.resume()
    }
    window.addEventListener("pointerdown", deverrouiller, { once: true })
    return () => window.removeEventListener("pointerdown", deverrouiller)
  }, [actif])

  return useMemo(
    () => ({
      actif,
      basculer: () => {
        const suivant = !actif
        setActif(suivant)
        try {
          localStorage.setItem(CLE_SON, suivant ? "1" : "0")
        } catch {
          // Préférence non mémorisée : sans conséquence.
        }
        if (suivant) {
          contexte.current ??= new AudioContext()
          void contexte.current.resume()
          carillon(contexte.current)
        }
      },
      jouer: () => {
        if (actif && contexte.current) carillon(contexte.current)
      },
    }),
    [actif],
  )
}

function carillon(ctx: AudioContext) {
  const debut = ctx.currentTime
  ;[880, 1320].forEach((frequence, i) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "sine"
    osc.frequency.value = frequence
    const t = debut + i * 0.18
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t)
    osc.stop(t + 0.55)
  })
}
