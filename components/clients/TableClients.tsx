"use client"

import { Loader2Icon, PencilIcon, PlusIcon, SearchIcon, Trash2Icon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { EnTetePage } from "@/components/layout/EnTetePage"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase/client"
import { cn, formatDateHeure, normaliser } from "@/lib/utils"
import {
  LIBELLES_TYPE_CLIENT,
  TYPES_CLIENT_PARTICULIER,
  TYPES_CLIENT_PRO,
  type Client,
  type TypeClient,
} from "@/types"

type Onglet = "pros" | "particuliers"

export function TableClients({ clientsInitiaux }: { clientsInitiaux: Client[] }) {
  const [clients, setClients] = useState(clientsInitiaux)
  const [onglet, setOnglet] = useState<Onglet>("pros")
  const [recherche, setRecherche] = useState("")
  const [edition, setEdition] = useState<Client | null>(null)
  const [modal, setModal] = useState(false)

  const types: TypeClient[] = onglet === "pros" ? TYPES_CLIENT_PRO : TYPES_CLIENT_PARTICULIER
  const q = normaliser(recherche)
  const visibles = clients
    .filter((c) => types.includes(c.type))
    .filter((c) => !q || normaliser(c.nom).includes(q) || (c.telephone ?? "").includes(recherche.trim()))
    .sort((a, b) => Number(b.actif) - Number(a.actif) || a.nom.localeCompare(b.nom, "fr"))

  function remplacer(c: Client) {
    setClients((liste) => (liste.some((x) => x.id === c.id) ? liste.map((x) => (x.id === c.id ? c : x)) : [...liste, c]))
  }

  async function basculerActif(c: Client, actif: boolean) {
    remplacer({ ...c, actif })
    const { error } = await createClient().from("clients").update({ actif }).eq("id", c.id)
    if (error) {
      remplacer(c)
      toast.error("Mise à jour impossible", { description: error.message })
    }
  }

  async function supprimer(c: Client) {
    if (!window.confirm(`Supprimer le client « ${c.nom} » ?`)) return
    const { error } = await createClient().from("clients").delete().eq("id", c.id)
    if (error) {
      toast.error(
        error.code === "23503"
          ? "Ce client a déjà des commandes : désactivez-le plutôt pour garder l'historique."
          : `Suppression impossible : ${error.message}`,
      )
      return
    }
    setClients((liste) => liste.filter((x) => x.id !== c.id))
    toast.success("Client supprimé")
  }

  return (
    <div>
      <EnTetePage
        titre="Clients"
        description="Clients professionnels gérés ici ; les particuliers sont aussi créés à la volée par les vendeurs."
        actions={
          <Button
            className="h-10"
            onClick={() => {
              setEdition(null)
              setModal(true)
            }}
          >
            <PlusIcon /> Ajouter un client
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg bg-muted p-1" role="tablist">
          {(
            [
              ["pros", "Professionnels / récurrents"],
              ["particuliers", "Particuliers"],
            ] as const
          ).map(([valeur, libelle]) => (
            <button
              key={valeur}
              role="tab"
              aria-selected={onglet === valeur}
              onClick={() => setOnglet(valeur)}
              className={cn(
                "min-h-9 rounded-md px-3 text-sm font-medium",
                onglet === valeur ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {libelle}{" "}
              <span className="text-muted-foreground tabular-nums">
                ({clients.filter((c) => (valeur === "pros" ? TYPES_CLIENT_PRO : TYPES_CLIENT_PARTICULIER).includes(c.type as never)).length})
              </span>
            </button>
          ))}
        </div>
        <div className="relative min-w-48 flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Nom ou téléphone…" className="h-10 pl-9" />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Téléphone</TableHead>
              <TableHead>Note</TableHead>
              {onglet === "particuliers" && <TableHead>Ajouté le</TableHead>}
              <TableHead>Actif</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  Aucun client.
                </TableCell>
              </TableRow>
            ) : (
              visibles.map((c) => (
                <TableRow key={c.id} className={cn(!c.actif && "text-muted-foreground")}>
                  <TableCell className="font-medium">{c.nom}</TableCell>
                  <TableCell>
                    <Badge variant={c.type === "regulier" ? "secondary" : "outline"}>{LIBELLES_TYPE_CLIENT[c.type]}</Badge>
                  </TableCell>
                  <TableCell className="tabular-nums">{c.telephone ?? "—"}</TableCell>
                  <TableCell className="max-w-64 truncate text-muted-foreground">{c.note ?? ""}</TableCell>
                  {onglet === "particuliers" && <TableCell>{formatDateHeure(c.created_at)}</TableCell>}
                  <TableCell>
                    <Switch
                      checked={c.actif}
                      onCheckedChange={(v) => void basculerActif(c, v)}
                      aria-label={c.actif ? `Désactiver ${c.nom}` : `Activer ${c.nom}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Modifier ${c.nom}`}
                        onClick={() => {
                          setEdition(c)
                          setModal(true)
                        }}
                      >
                        <PencilIcon />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label={`Supprimer ${c.nom}`} onClick={() => void supprimer(c)}>
                        <Trash2Icon />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={modal} onOpenChange={setModal}>
        <DialogContent className="sm:max-w-lg">
          {modal && (
            <FormClient
              client={edition}
              typeParDefaut={onglet === "pros" ? "tournee" : "regulier"}
              surEnregistre={(c) => {
                remplacer(c)
                setModal(false)
              }}
              surAnnuler={() => setModal(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FormClient({
  client,
  typeParDefaut,
  surEnregistre,
  surAnnuler,
}: {
  client: Client | null
  typeParDefaut: TypeClient
  surEnregistre: (c: Client) => void
  surAnnuler: () => void
}) {
  const [nom, setNom] = useState(client?.nom ?? "")
  const [type, setType] = useState<TypeClient>(client?.type ?? typeParDefaut)
  const [telephone, setTelephone] = useState(client?.telephone ?? "")
  const [note, setNote] = useState(client?.note ?? "")
  const [actif, setActif] = useState(client?.actif ?? true)
  const [enCours, setEnCours] = useState(false)

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault()
    if (!nom.trim()) return
    setEnCours(true)
    const valeurs = { nom: nom.trim(), type, telephone: telephone.trim() || null, note: note.trim() || null, actif }
    const supabase = createClient()
    const { data, error } = client
      ? await supabase.from("clients").update(valeurs).eq("id", client.id).select().single()
      : await supabase.from("clients").insert(valeurs).select().single()
    setEnCours(false)
    if (error) {
      toast.error("Enregistrement impossible", { description: error.message })
      return
    }
    toast.success(client ? "Client mis à jour" : "Client ajouté")
    surEnregistre(data as Client)
  }

  return (
    <form onSubmit={enregistrer} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{client ? "Modifier le client" : "Ajouter un client"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-2">
        <Label htmlFor="c-nom">Nom</Label>
        <Input id="c-nom" value={nom} onChange={(e) => setNom(e.target.value)} required autoFocus className="h-11" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as TypeClient)}>
            <SelectTrigger className="h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[...TYPES_CLIENT_PRO, ...TYPES_CLIENT_PARTICULIER].map((t) => (
                <SelectItem key={t} value={t}>
                  {LIBELLES_TYPE_CLIENT[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="c-tel">Téléphone</Label>
          <Input id="c-tel" type="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} className="h-11" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="c-note">Note</Label>
        <Textarea id="c-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Horaires de livraison, contact…" />
      </div>
      <div className="flex items-center gap-3">
        <Switch id="c-actif" checked={actif} onCheckedChange={setActif} />
        <Label htmlFor="c-actif">Actif (proposé à la saisie)</Label>
      </div>
      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={surAnnuler}>
          Annuler
        </Button>
        <Button type="submit" disabled={enCours || !nom.trim()}>
          {enCours && <Loader2Icon className="animate-spin" />}
          Enregistrer
        </Button>
      </DialogFooter>
    </form>
  )
}
