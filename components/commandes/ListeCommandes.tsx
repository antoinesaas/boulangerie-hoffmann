"use client"

import { CalendarDaysIcon, CheckCheckIcon, Loader2Icon, RefreshCwIcon, RepeatIcon, SearchIcon, Trash2Icon, XIcon } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { changerStatut, SELECT_COMMANDE_DETAIL, useCommandes } from "@/lib/hooks/useCommandes"
import { useRealtime } from "@/lib/hooks/useRealtime"
import { createClient } from "@/lib/supabase/client"
import { useFileAttente } from "@/lib/hooks/useFileAttente"
import { reessayerOperation, retirerOperation, synchroniser } from "@/lib/offline/fileAttente"
import { BandeauJours, NB_JOURS_BANDEAU } from "@/components/calendrier/BandeauJours"
import {
  ajouterJours,
  aujourdhui,
  cn,
  formatDateHeure,
  formatJourMoisCourt,
  formatJourSemaine,
  formatPrix,
  formatQuantite,
  libelleJour,
} from "@/lib/utils"
import {
  NOMS_JOURS_SEMAINE,
  type CommandeDetail,
  type CommandeRecurrenteDetail,
  type PointDeVente,
  type Produit,
  type Role,
  type StatutCommande,
} from "@/types"
import { CarteCommande } from "./CarteCommande"

interface Props {
  role: Role
  /** Vendeur : son point de vente. Admin : null = filtre libre. */
  pointDeVenteId: string | null
  pointsDeVente: Pick<PointDeVente, "id" | "nom">[]
  produits: Pick<Produit, "id" | "nom" | "unite">[]
}

type Onglet = "jours" | "habituelles" | "recherche"

/** Arrête une commande habituelle pour toujours (les prochaines semaines sont annulées). */
async function arreterHabitude(recurrenteId: string, nomClient: string) {
  if (!window.confirm(`Arrêter pour toujours la commande habituelle de ${nomClient} ?`)) return false
  const { error } = await createClient().rpc("arreter_recurrence", { p_id: recurrenteId })
  if (error) {
    toast.error("Impossible d'arrêter", { description: error.message })
    return false
  }
  toast.success(`Commande habituelle de ${nomClient} arrêtée`)
  return true
}

/** « Mes commandes » : par jour, commandes habituelles, recherche. */
export function ListeCommandes(props: Props) {
  const [onglet, setOnglet] = useState<Onglet>("jours")
  const [filtrePdv, setFiltrePdv] = useState<string>(props.pointDeVenteId ?? "tous")
  const pdv = props.pointDeVenteId ?? (filtrePdv === "tous" ? null : filtrePdv)

  return (
    <div className="space-y-4 px-4 pt-4">
      <FileAttenteVendeur />

      {props.role === "admin" && (
        <Select value={filtrePdv} onValueChange={setFiltrePdv}>
          <SelectTrigger className="h-12 w-full text-base">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tous" className="min-h-11">
              Tous les points de vente
            </SelectItem>
            {props.pointsDeVente.map((p) => (
              <SelectItem key={p.id} value={p.id} className="min-h-11">
                {p.nom}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1" role="tablist">
        {(
          [
            ["jours", "Par jour", CalendarDaysIcon],
            ["habituelles", "Habituelles", RepeatIcon],
            ["recherche", "Recherche", SearchIcon],
          ] as const
        ).map(([valeur, libelle, Icone]) => (
          <button
            key={valeur}
            role="tab"
            aria-selected={onglet === valeur}
            onClick={() => setOnglet(valeur)}
            className={cn(
              "flex min-h-11 items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors",
              onglet === valeur ? "bg-background shadow-sm" : "text-muted-foreground",
            )}
          >
            <Icone className="hidden size-4 min-[400px]:block" /> {libelle}
          </button>
        ))}
      </div>

      {onglet === "jours" && <ParJour pdv={pdv} afficherPointDeVente={!props.pointDeVenteId} />}
      {onglet === "habituelles" && <Habituelles pdv={pdv} produits={props.produits} />}
      {onglet === "recherche" && <Recherche pdv={pdv} afficherPointDeVente={!props.pointDeVenteId} />}
    </div>
  )
}

/** Boutons d'action d'une carte commande (annuler, livrée, habitudes). */
function ActionsCommande({
  c,
  appliquer,
}: {
  c: CommandeDetail
  appliquer: (c: CommandeDetail, statut: StatutCommande) => void
}) {
  return (
    <>
      {c.statut === "en_attente" && (
        <Button
          variant="outline"
          className="h-11"
          onClick={() => {
            const question = c.recurrente_id
              ? `Annuler la commande de ${c.client?.nom} pour ${libelleJour(c.date_livraison).toLowerCase()} seulement ?`
              : `Annuler la commande de ${c.client?.nom} (${libelleJour(c.date_livraison)}) ?`
            if (window.confirm(question)) appliquer(c, "annulee")
          }}
        >
          <XIcon /> {c.recurrente_id ? "Annuler cette semaine" : "Annuler"}
        </Button>
      )}
      {c.recurrente_id && c.statut !== "livree" && (
        <Button
          variant="ghost"
          className="h-11 text-destructive"
          onClick={() => void arreterHabitude(c.recurrente_id!, c.client?.nom ?? "ce client")}
        >
          Arrêter pour toujours
        </Button>
      )}
      {(c.statut === "en_attente" || c.statut === "preparee") && (
        <Button className="h-11" onClick={() => appliquer(c, "livree")}>
          <CheckCheckIcon /> Livrée
        </Button>
      )}
    </>
  )
}

function useAppliquerStatut(majLocale: (id: string, patch: Partial<CommandeDetail>) => void) {
  return useCallback(
    async (c: CommandeDetail, statut: StatutCommande) => {
      const precedent = c.statut
      majLocale(c.id, { statut })
      const err = await changerStatut(c.id, statut)
      if (err) {
        majLocale(c.id, { statut: precedent })
        toast.error("Action impossible", { description: err.message })
      } else {
        toast.success(statut === "livree" ? `${c.client?.nom} : livrée` : `${c.client?.nom} : annulée`)
      }
    },
    [majLocale],
  )
}

/** Onglet « Par jour » : la semaine à venir + calendrier. */
function ParJour({ pdv, afficherPointDeVente }: { pdv: string | null; afficherPointDeVente: boolean }) {
  const [jour] = useState(aujourdhui)
  const [jourActif, setJourActif] = useState(jour)

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

  const appliquer = useAppliquerStatut(majLocale)

  return (
    <div className="space-y-4">
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
                afficherPointDeVente={afficherPointDeVente}
                actions={<ActionsCommande c={c} appliquer={(x, st) => void appliquer(x, st)} />}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/** Onglet « Habituelles » : commandes répétées chaque semaine. */
function Habituelles({ pdv, produits }: { pdv: string | null; produits: Props["produits"] }) {
  const [liste, setListe] = useState<CommandeRecurrenteDetail[] | null>(null)
  const nomsProduits = new Map(produits.map((p) => [p.id, p]))

  const charger = useCallback(async () => {
    let requete = createClient()
      .from("commandes_recurrentes")
      .select("*, client:clients(id, nom, type), point_de_vente:points_de_vente(id, nom)")
      .eq("actif", true)
      .order("jour_semaine")
    if (pdv) requete = requete.eq("point_de_vente_id", pdv)
    const { data } = await requete
    setListe((data ?? []) as CommandeRecurrenteDetail[])
  }, [pdv])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void charger()
  }, [charger])
  useRealtime(["commandes_recurrentes"], charger)

  if (liste === null) {
    return (
      <div className="flex justify-center py-10 text-muted-foreground">
        <Loader2Icon className="animate-spin" />
      </div>
    )
  }
  if (liste.length === 0) {
    return (
      <p className="py-10 text-center text-muted-foreground">
        Aucune commande habituelle. Pour en créer une, activez « Toutes les semaines » en saisissant la commande.
      </p>
    )
  }

  return (
    <ul className="space-y-3">
      {liste.map((h) => (
        <li key={h.id} className="rounded-xl border bg-background p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-semibold">{h.client?.nom ?? "Client supprimé"}</div>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <RepeatIcon className="size-3.5" /> Chaque {NOMS_JOURS_SEMAINE[h.jour_semaine]}
                {!pdv && h.point_de_vente ? ` · ${h.point_de_vente.nom}` : ""}
              </div>
            </div>
            <Button
              variant="ghost"
              className="h-11 shrink-0 text-destructive"
              onClick={async () => {
                if (await arreterHabitude(h.id, h.client?.nom ?? "ce client")) void charger()
              }}
            >
              <Trash2Icon /> Arrêter
            </Button>
          </div>
          <ul className="mt-2 space-y-0.5 text-sm">
            {[...h.lignes]
              .sort((a, b) => produits.findIndex((p) => p.id === a.produit_id) - produits.findIndex((p) => p.id === b.produit_id))
              .map((l) => (
              <li key={l.produit_id}>
                <span className="font-semibold tabular-nums">{formatQuantite(l.quantite)}</span>{" "}
                {nomsProduits.get(l.produit_id)?.nom ?? "Produit"}
              </li>
            ))}
          </ul>
          {h.notes && <p className="mt-1 text-sm italic text-muted-foreground">« {h.notes} »</p>}
          <p className="mt-2 text-xs text-muted-foreground">
            Pour sauter une seule semaine : onglet « Par jour », choisissez le jour puis « Annuler cette semaine ».
          </p>
        </li>
      ))}
    </ul>
  )
}

/** Onglet « Recherche » : retrouver une commande par nom ou téléphone du client, ou par note. */
function Recherche({ pdv, afficherPointDeVente }: { pdv: string | null; afficherPointDeVente: boolean }) {
  const [texte, setTexte] = useState("")
  const [resultats, setResultats] = useState<CommandeDetail[] | null>(null)
  const [enCours, setEnCours] = useState(false)
  const terme = texte.trim().replace(/[,()%*]/g, " ").trim()

  const chercher = useCallback(async () => {
    if (terme.length < 2) {
      setResultats(null)
      return
    }
    setEnCours(true)
    const supabase = createClient()
    const base = () => {
      let q = supabase
        .from("commandes")
        .select(SELECT_COMMANDE_DETAIL.replace("client:clients(", "client:clients!inner("))
        .order("date_livraison", { ascending: false })
        .limit(50)
      if (pdv) q = q.eq("point_de_vente_id", pdv)
      return q
    }
    const [parClient, parNote] = await Promise.all([
      base().or(`nom.ilike.%${terme}%,telephone.ilike.%${terme}%`, { referencedTable: "client" }),
      base().ilike("notes", `%${terme}%`),
    ])
    const fusion = new Map<string, CommandeDetail>()
    for (const c of [...((parClient.data ?? []) as unknown as CommandeDetail[]), ...((parNote.data ?? []) as unknown as CommandeDetail[])]) {
      fusion.set(c.id, c)
    }
    setResultats([...fusion.values()].sort((a, b) => b.date_livraison.localeCompare(a.date_livraison)))
    setEnCours(false)
  }, [terme, pdv])

  useEffect(() => {
    const t = setTimeout(() => void chercher(), 300)
    return () => clearTimeout(t)
  }, [chercher])

  const majLocale = useCallback((id: string, patch: Partial<CommandeDetail>) => {
    setResultats((l) => l?.map((c) => (c.id === id ? { ...c, ...patch } : c)) ?? l)
  }, [])
  const appliquer = useAppliquerStatut(majLocale)

  return (
    <div className="space-y-3">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          placeholder="Nom, téléphone ou note…"
          enterKeyHint="search"
          autoFocus
          className="h-12 pl-10 text-base"
        />
      </div>
      {enCours && (
        <div className="flex justify-center py-6 text-muted-foreground">
          <Loader2Icon className="animate-spin" />
        </div>
      )}
      {!enCours && resultats === null && (
        <p className="py-6 text-center text-sm text-muted-foreground">Tapez au moins 2 lettres.</p>
      )}
      {!enCours && resultats?.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">Aucune commande trouvée.</p>
      )}
      {!enCours &&
        resultats?.map((c) => (
          <CarteCommande
            key={c.id}
            commande={c}
            afficherDate
            afficherPointDeVente={afficherPointDeVente}
            actions={<ActionsCommande c={c} appliquer={(x, st) => void appliquer(x, st)} />}
          />
        ))}
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

