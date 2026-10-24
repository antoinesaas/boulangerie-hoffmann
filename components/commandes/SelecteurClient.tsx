"use client"

import { PhoneIcon, SearchIcon, UserIcon, UserPlusIcon, XIcon } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { ModalNouveauClient } from "@/components/clients/ModalNouveauClient"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { normaliser } from "@/lib/utils"
import { LIBELLES_TYPE_CLIENT, TYPES_CLIENT_PRO, type Client } from "@/types"

interface Props {
  clients: Client[]
  selection: Client | null
  surSelection: (client: Client | null) => void
  surNouveauClient: (client: Client) => void
}

const MAX_RESULTATS = 8

/** Recherche client avec autocomplétion (pros + particuliers) et création à la volée. */
export function SelecteurClient({ clients, selection, surSelection, surNouveauClient }: Props) {
  const [recherche, setRecherche] = useState("")
  const [focus, setFocus] = useState(false)
  const [modal, setModal] = useState(false)
  const [distants, setDistants] = useState<Client[]>([])

  // Les anciens particuliers occasionnels ne sont pas préchargés : recherche serveur en complément.
  useEffect(() => {
    const terme = recherche.trim()
    if (terme.length < 2) return
    const minuteur = setTimeout(async () => {
      const { data } = await createClient()
        .from("clients")
        .select("*")
        .eq("actif", true)
        .ilike("nom", `%${terme}%`)
        .limit(10)
      if (data) setDistants(data as Client[])
    }, 250)
    return () => clearTimeout(minuteur)
  }, [recherche])

  const resultats = useMemo(() => {
    const q = normaliser(recherche)
    const connus = new Set(clients.map((c) => c.id))
    const source = q.length >= 2 ? [...clients, ...distants.filter((c) => !connus.has(c.id))] : clients
    const filtres = q
      ? source.filter((c) => normaliser(c.nom).includes(q) || (c.telephone ?? "").replace(/\s/g, "").includes(q.replace(/\s/g, "")))
      : clients
    // Pros d'abord, puis particuliers réguliers, puis occasionnels ; préfixe exact en tête.
    const rang = (c: Client) =>
      (q && normaliser(c.nom).startsWith(q) ? 0 : 10) +
      (TYPES_CLIENT_PRO.includes(c.type as never) ? 0 : c.type === "regulier" ? 1 : 2)
    return [...filtres].sort((a, b) => rang(a) - rang(b) || a.nom.localeCompare(b.nom, "fr")).slice(0, MAX_RESULTATS)
  }, [clients, distants, recherche])

  if (selection) {
    return (
      <section className="rounded-xl border bg-background p-4">
        <Label className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          <UserIcon className="size-4" /> Client
        </Label>
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-semibold">{selection.nom}</div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary">{LIBELLES_TYPE_CLIENT[selection.type]}</Badge>
              {selection.telephone && (
                <span className="inline-flex items-center gap-1">
                  <PhoneIcon className="size-3" /> {selection.telephone}
                </span>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            className="h-11"
            onClick={() => {
              surSelection(null)
              setRecherche("")
            }}
          >
            Changer
          </Button>
        </div>
      </section>
    )
  }

  const listeVisible = focus || recherche.length > 0

  return (
    <section className="rounded-xl border bg-background p-4">
      <Label
        htmlFor="recherche-client"
        className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground"
      >
        <UserIcon className="size-4" /> Client
      </Label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="recherche-client"
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            onFocus={() => setFocus(true)}
            onBlur={() => setTimeout(() => setFocus(false), 150)}
            placeholder="Nom ou téléphone…"
            autoComplete="off"
            className="h-12 pl-10 pr-10 text-base"
          />
          {recherche && (
            <button
              type="button"
              onClick={() => setRecherche("")}
              aria-label="Effacer la recherche"
              className="absolute right-0 top-0 flex size-12 items-center justify-center text-muted-foreground"
            >
              <XIcon className="size-4" />
            </button>
          )}
        </div>
        <Button type="button" variant="secondary" className="h-12 px-3" onClick={() => setModal(true)}>
          <UserPlusIcon className="size-5" />
          <span className="sr-only sm:not-sr-only">Nouveau client</span>
        </Button>
      </div>

      {listeVisible && (
        <ul className="mt-2 divide-y overflow-hidden rounded-lg border" role="listbox" aria-label="Clients">
          {resultats.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  surSelection(c)
                  setRecherche("")
                }}
                className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted active:bg-muted"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{c.nom}</span>
                  {c.telephone && <span className="block text-xs text-muted-foreground">{c.telephone}</span>}
                </span>
                <Badge variant={TYPES_CLIENT_PRO.includes(c.type as never) ? "default" : "outline"}>
                  {LIBELLES_TYPE_CLIENT[c.type]}
                </Badge>
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setModal(true)}
              className="flex min-h-12 w-full items-center gap-2 px-3 py-2 text-left font-medium text-primary hover:bg-muted"
            >
              <UserPlusIcon className="size-4" />
              {recherche ? `➕ Nouveau client « ${recherche.trim()} »` : "➕ Nouveau client"}
            </button>
          </li>
        </ul>
      )}

      <ModalNouveauClient
        ouvert={modal}
        surChangementOuvert={setModal}
        nomInitial={recherche.trim()}
        clientsExistants={clients}
        surCree={(c) => {
          setRecherche("")
          if (clients.some((x) => x.id === c.id)) surSelection(c)
          else surNouveauClient(c)
        }}
      />
    </section>
  )
}
