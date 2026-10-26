"use client"

import { CalendarIcon, Loader2Icon, MinusIcon, PlusIcon, RepeatIcon, SendIcon, StoreIcon } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useFileAttente } from "@/lib/hooks/useFileAttente"
import { ajouterOperation, lireFile, synchroniser } from "@/lib/offline/fileAttente"
import {
  ajouterJours,
  arrondi,
  aujourdhui,
  calcTTC,
  cn,
  formatDate,
  formatPrix,
  formatQuantite,
  formatUnite,
  jourSemaineIso,
  totalLignes,
  uuid,
} from "@/lib/utils"
import {
  CATEGORIES,
  LIBELLES_CATEGORIE,
  NOMS_JOURS_SEMAINE,
  type Client,
  type CommandePayload,
  type PointDeVente,
  type Produit,
} from "@/types"
import { SelecteurClient } from "./SelecteurClient"

interface Props {
  produits: Produit[]
  clients: Client[]
  pointsDeVente: Pick<PointDeVente, "id" | "nom">[]
  /** Vendeur : point de vente imposé par le compte. Admin : null (choix libre). */
  pointDeVenteFixe: Pick<PointDeVente, "id" | "nom"> | null
}

const pas = (p: Produit) => (p.unite === "kg" ? 0.5 : 1)

export function FormulaireCommande({ produits, clients, pointsDeVente, pointDeVenteFixe }: Props) {
  const file = useFileAttente()
  const [clientsLocaux, setClientsLocaux] = useState<Client[]>([])
  const [client, setClient] = useState<Client | null>(null)
  const [date, setDate] = useState(() => ajouterJours(aujourdhui(), 1))
  // Commande habituelle : répétée chaque semaine les jours cochés (1 = lundi … 7 = dimanche)
  const [repeter, setRepeter] = useState(false)
  const [joursRepet, setJoursRepet] = useState<number[]>([])
  const joursEffectifs = repeter ? (joursRepet.length ? joursRepet : [jourSemaineIso(date)]) : []

  function choisirClient(c: Client | null) {
    setClient(c)
    // Un client régulier commande chaque semaine : répétition proposée d'office.
    if (c?.type === "regulier" || c?.type === "point_de_vente") {
      setRepeter(true)
      setJoursRepet([])
    } else {
      setRepeter(false)
      setJoursRepet([])
    }
  }
  const [quantites, setQuantites] = useState<Record<string, number>>({})
  const [notes, setNotes] = useState("")
  const [pdvId, setPdvId] = useState(pointDeVenteFixe?.id ?? pointsDeVente[0]?.id ?? "")
  const [confirmation, setConfirmation] = useState(false)
  const [envoi, setEnvoi] = useState(false)

  // Clients du serveur + créés sur cet appareil (y compris en attente d'envoi).
  const tousClients = useMemo(() => {
    const parId = new Map<string, Client>()
    for (const c of clients) parId.set(c.id, c)
    for (const op of file) {
      if (op.type === "client" && !parId.has(op.id)) {
        parId.set(op.id, { ...op.data, note: null, actif: true, cree_par: null, created_at: op.creeLe })
      }
    }
    for (const c of clientsLocaux) if (!parId.has(c.id)) parId.set(c.id, c)
    return [...parId.values()]
  }, [clients, clientsLocaux, file])

  const parCategorie = useMemo(
    () =>
      CATEGORIES.map((cat) => ({
        categorie: cat,
        produits: produits.filter((p) => p.categorie === cat),
      })).filter((g) => g.produits.length > 0),
    [produits],
  )

  const lignes = produits
    .filter((p) => (quantites[p.id] ?? 0) > 0)
    .map((p) => ({ produit: p, quantite: quantites[p.id], prix_ht: p.prix_ht, tva: p.tva }))
  const total = totalLignes(lignes)
  const nbArticles = lignes.reduce((s, l) => s + l.quantite, 0)
  const pdvNom = pointDeVenteFixe?.nom ?? pointsDeVente.find((p) => p.id === pdvId)?.nom ?? ""
  const pret = Boolean(client && lignes.length > 0 && date && (pointDeVenteFixe || pdvId))

  function changerQuantite(produit: Produit, delta: number) {
    setQuantites((q) => {
      const valeur = Math.max(0, Math.round(((q[produit.id] ?? 0) + delta) * 1000) / 1000)
      return { ...q, [produit.id]: valeur }
    })
  }

  function reinitialiser() {
    setClient(null)
    setQuantites({})
    setNotes("")
    setDate(ajouterJours(aujourdhui(), 1))
    setRepeter(false)
    setJoursRepet([])
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function envoyer() {
    if (!client || !pret) return
    setEnvoi(true)
    const payload: CommandePayload = {
      p_id: uuid(),
      p_client_id: client.id,
      p_date_livraison: date,
      p_lignes: lignes.map((l) => ({ produit_id: l.produit.id, quantite: l.quantite })),
      p_notes: notes.trim() || null,
      p_point_de_vente_id: pointDeVenteFixe?.id ?? pdvId,
      p_jours_semaine: joursEffectifs.length ? joursEffectifs : null,
    }
    ajouterOperation({
      type: "commande",
      id: payload.p_id,
      data: payload,
      resume: { client: client.nom, total_ttc: total.ttc, nb_articles: nbArticles },
      creeLe: new Date().toISOString(),
    })

    const resultat = await synchroniser()
    setEnvoi(false)
    setConfirmation(false)

    const restante = lireFile().find((o) => o.id === payload.p_id)
    if (resultat.envoyees.includes(payload.p_id)) {
      toast.success(`Commande de ${client.nom} envoyée au fornil`, {
        description: joursEffectifs.length
          ? `Chaque semaine : ${libelleJoursRepet(joursEffectifs)} (à partir du ${formatDate(date)})`
          : formatDate(date),
      })
      reinitialiser()
    } else if (restante?.erreur) {
      toast.error("Commande refusée par le serveur", { description: restante.erreur })
    } else {
      toast.warning("Hors ligne : commande gardée sur le téléphone", {
        description: "Elle partira automatiquement au retour du réseau.",
      })
      reinitialiser()
    }
  }

  const raccourcisDate = [
    { libelle: "Aujourd'hui", valeur: aujourdhui() },
    { libelle: "Demain", valeur: ajouterJours(aujourdhui(), 1) },
    { libelle: "Après-demain", valeur: ajouterJours(aujourdhui(), 2) },
  ]

  return (
    <div className="space-y-4 px-4 pt-4">
      {/* 1. Point de vente */}
      <section className="rounded-xl border bg-background p-4">
        <Label className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          <StoreIcon className="size-4" /> Point de vente
        </Label>
        {pointDeVenteFixe ? (
          <div className="flex min-h-11 items-center text-lg font-semibold">{pointDeVenteFixe.nom}</div>
        ) : (
          <Select value={pdvId} onValueChange={setPdvId}>
            <SelectTrigger className="h-12 w-full text-base">
              <SelectValue placeholder="Choisir" />
            </SelectTrigger>
            <SelectContent>
              {pointsDeVente.map((p) => (
                <SelectItem key={p.id} value={p.id} className="min-h-11">
                  {p.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </section>

      {/* 2. Client */}
      <SelecteurClient
        clients={tousClients}
        selection={client}
        surSelection={choisirClient}
        surNouveauClient={(c) => {
          setClientsLocaux((l) => [...l, c])
          choisirClient(c)
        }}
      />

      {/* 3. Date de livraison */}
      <section className="rounded-xl border bg-background p-4">
        <Label
          htmlFor="date-livraison"
          className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground"
        >
          <CalendarIcon className="size-4" /> Livraison
        </Label>
        <div className="mb-2 grid grid-cols-3 gap-2">
          {raccourcisDate.map((r) => (
            <button
              key={r.valeur}
              type="button"
              onClick={() => setDate(r.valeur)}
              aria-pressed={date === r.valeur}
              className={cn(
                "min-h-11 rounded-lg border text-sm font-medium transition-colors",
                date === r.valeur ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              {r.libelle}
            </button>
          ))}
        </div>
        <input
          id="date-livraison"
          type="date"
          value={date}
          min={aujourdhui()}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="h-12 w-full rounded-lg border bg-transparent px-3 text-base"
        />
        <p className="mt-1 text-sm text-muted-foreground first-letter:uppercase">{formatDate(date)}</p>

        <div className="mt-3 rounded-lg border p-3">
          <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
            <span className="flex items-center gap-2 font-medium">
              <RepeatIcon className="size-4" /> Toutes les semaines
            </span>
            <Switch
              checked={repeter}
              onCheckedChange={(v) => {
                setRepeter(v)
                setJoursRepet([])
              }}
            />
          </label>
          {repeter && (
            <>
              <div className="mt-2 grid grid-cols-7 gap-1">
                {[1, 2, 3, 4, 5, 6, 7].map((j) => {
                  const coche = joursEffectifs.includes(j)
                  return (
                    <button
                      key={j}
                      type="button"
                      aria-pressed={coche}
                      aria-label={NOMS_JOURS_SEMAINE[j]}
                      onClick={() =>
                        setJoursRepet((liste) => {
                          const base = liste.length ? liste : [jourSemaineIso(date)]
                          const suivante = base.includes(j) ? base.filter((x) => x !== j) : [...base, j].sort()
                          return suivante.length ? suivante : base
                        })
                      }
                      className={cn(
                        "min-h-11 rounded-lg border text-sm font-semibold uppercase",
                        coche ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                      )}
                    >
                      {NOMS_JOURS_SEMAINE[j].slice(0, 2)}
                    </button>
                  )
                })}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Commande habituelle : chaque {libelleJoursRepet(joursEffectifs)}. Annulable pour une semaine ou pour
                toujours dans « Mes commandes ».
              </p>
            </>
          )}
        </div>
      </section>

      {/* 4. Produits */}
      <section className="rounded-xl border bg-background">
        {parCategorie.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">Aucun produit actif dans le catalogue.</p>
        )}
        {parCategorie.map((groupe) => (
          <div key={groupe.categorie}>
            <h2 className="sticky top-14 z-10 border-b bg-muted/80 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur">
              {LIBELLES_CATEGORIE[groupe.categorie]}
            </h2>
            <ul className="divide-y">
              {groupe.produits.map((p) => {
                const q = quantites[p.id] ?? 0
                return (
                  <li key={p.id} className={cn("flex items-center gap-3 px-4 py-2", q > 0 && "bg-primary/5")}>
                    <div className="min-w-0 flex-1">
                      <div className={cn("line-clamp-2 leading-tight font-medium", q > 0 && "font-semibold")}>{p.nom}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatPrix(calcTTC(p.prix_ht, p.tva))} / {formatUnite(p.unite, 1)}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center">
                      <Button
                        type="button"
                        variant="outline"
                        className="size-12 rounded-full"
                        onClick={() => changerQuantite(p, -pas(p))}
                        disabled={q === 0}
                        aria-label={`Retirer ${p.nom}`}
                      >
                        <MinusIcon className="size-5" />
                      </Button>
                      <ChampQuantite
                        libelle={`Quantité ${p.nom}`}
                        valeur={q}
                        surChange={(v) => setQuantites((liste) => ({ ...liste, [p.id]: v }))}
                      />
                      <Button
                        type="button"
                        className="size-12 rounded-full"
                        onClick={() => changerQuantite(p, pas(p))}
                        aria-label={`Ajouter ${p.nom}`}
                      >
                        <PlusIcon className="size-5" />
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </section>

      {/* 5. Notes */}
      <section className="rounded-xl border bg-background p-4">
        <Label htmlFor="notes" className="mb-2 block text-xs uppercase tracking-wide text-muted-foreground">
          Notes
        </Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Bien cuit, tranché, à retirer à 11h…"
          className="min-h-20 text-base"
        />
      </section>

      {/* 6–7. Total + envoi, collés en bas au-dessus de la navigation */}
      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">
            {lignes.length === 0
              ? "Aucun produit"
              : `${formatQuantite(nbArticles)} article${nbArticles > 1 ? "s" : ""} · total estimé`}
          </span>
          <span className="text-2xl font-bold tabular-nums">{formatPrix(total.ttc)}</span>
        </div>
        <Button
          type="button"
          className="h-14 w-full text-lg"
          disabled={!pret}
          onClick={() => setConfirmation(true)}
        >
          <SendIcon className="size-5" />
          {client ? "Envoyer au fornil" : "Choisissez un client"}
        </Button>
      </div>

      <Dialog open={confirmation} onOpenChange={(o) => !envoi && setConfirmation(o)}>
        {/* En bas sur mobile : les boutons restent sous le pouce */}
        <DialogContent className="top-auto bottom-[calc(1rem+env(safe-area-inset-bottom))] translate-y-0 sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2">
          <DialogHeader>
            <DialogTitle>Envoyer au fornil ?</DialogTitle>
            <DialogDescription className="first-letter:uppercase">
              {client?.nom} · {formatDate(date)} · {pdvNom}
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-[45dvh] divide-y overflow-y-auto rounded-lg border">
            {lignes.map((l) => (
              <li key={l.produit.id} className="flex items-center justify-between gap-3 px-3 py-2 text-base">
                <span>
                  <span className="font-semibold tabular-nums">{formatQuantite(l.quantite)}</span>
                  {l.produit.unite !== "pièce" && ` ${formatUnite(l.produit.unite, l.quantite)}`} × {l.produit.nom}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {formatPrix(arrondi(l.quantite * l.prix_ht * (1 + l.tva / 100)))}
                </span>
              </li>
            ))}
          </ul>
          {notes.trim() && <p className="text-sm italic text-muted-foreground">« {notes.trim()} »</p>}
          {joursEffectifs.length > 0 && (
            <p className="flex items-center gap-2 rounded-lg bg-primary/5 px-3 py-2 text-sm font-medium">
              <RepeatIcon className="size-4" /> Toutes les semaines : {libelleJoursRepet(joursEffectifs)}
            </p>
          )}
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Total TTC estimé</span>
            <span className="text-xl font-bold tabular-nums">{formatPrix(total.ttc)}</span>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="h-12" onClick={() => setConfirmation(false)} disabled={envoi}>
              Modifier
            </Button>
            <Button className="h-12 text-base" onClick={() => void envoyer()} disabled={envoi}>
              {envoi ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
              Confirmer l&apos;envoi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** Saisie directe d'une quantité (virgule acceptée), sans perdre la frappe en cours. */
function ChampQuantite({
  libelle,
  valeur,
  surChange,
}: {
  libelle: string
  valeur: number
  surChange: (valeur: number) => void
}) {
  const [texte, setTexte] = useState<string | null>(null)

  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={libelle}
      value={texte ?? (valeur === 0 ? "" : formatQuantite(valeur))}
      placeholder="0"
      onFocus={(e) => {
        setTexte(valeur === 0 ? "" : formatQuantite(valeur))
        const champ = e.target
        requestAnimationFrame(() => champ.select())
      }}
      onChange={(e) => {
        setTexte(e.target.value)
        const v = Number(e.target.value.replace(",", ".").replace(/\s/g, ""))
        surChange(Number.isFinite(v) && v > 0 ? Math.round(v * 1000) / 1000 : 0)
      }}
      onBlur={() => setTexte(null)}
      className="h-12 w-14 rounded-lg bg-transparent text-center text-lg font-semibold tabular-nums outline-none focus:ring-2 focus:ring-ring"
    />
  )
}

export function libelleJoursRepet(jours: number[]): string {
  return [...jours].sort().map((j) => NOMS_JOURS_SEMAINE[j]).join(", ")
}
