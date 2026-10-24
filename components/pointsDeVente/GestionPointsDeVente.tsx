"use client"

import { ArrowDownIcon, ArrowUpIcon, CheckIcon, PlusIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { EnTetePage } from "@/components/layout/EnTetePage"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import type { PointDeVente } from "@/types"

export function GestionPointsDeVente({ initiaux }: { initiaux: PointDeVente[] }) {
  const [pdvs, setPdvs] = useState(initiaux)
  const [nouveau, setNouveau] = useState("")
  const tries = [...pdvs].sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom, "fr"))

  function remplacer(p: PointDeVente) {
    setPdvs((l) => (l.some((x) => x.id === p.id) ? l.map((x) => (x.id === p.id ? p : x)) : [...l, p]))
  }

  async function maj(p: PointDeVente, valeurs: Partial<PointDeVente>) {
    remplacer({ ...p, ...valeurs })
    const { error } = await createClient().from("points_de_vente").update(valeurs).eq("id", p.id)
    if (error) {
      remplacer(p)
      toast.error("Mise à jour impossible", { description: error.message })
      return false
    }
    return true
  }

  async function ajouter(e: React.FormEvent) {
    e.preventDefault()
    const nom = nouveau.trim()
    if (!nom) return
    const ordre = Math.max(0, ...pdvs.map((p) => p.ordre)) + 1
    const { data, error } = await createClient().from("points_de_vente").insert({ nom, ordre }).select().single()
    if (error) {
      toast.error("Ajout impossible", { description: error.message })
      return
    }
    remplacer(data as PointDeVente)
    setNouveau("")
    toast.success(`Point de vente « ${nom} » ajouté`)
  }

  async function deplacer(p: PointDeVente, sens: -1 | 1) {
    const i = tries.findIndex((x) => x.id === p.id)
    const voisin = tries[i + sens]
    if (!voisin) return
    const ordreA = voisin.ordre === p.ordre ? p.ordre + sens : voisin.ordre
    const ordreB = p.ordre
    await Promise.all([maj(p, { ordre: ordreA }), maj(voisin, { ordre: ordreB })])
  }

  return (
    <div className="max-w-2xl">
      <EnTetePage
        titre="Points de vente"
        description="L'ordre définit l'ordre des sections au fornil. Un point de vente désactivé n'est plus proposé à la saisie."
      />

      <ul className="divide-y rounded-xl border bg-background">
        {tries.map((p) => (
          <LignePdv
            key={p.id}
            pdv={p}
            surRenommer={(nom) => maj(p, { nom })}
            surActif={(actif) => void maj(p, { actif })}
            surMonter={() => void deplacer(p, -1)}
            surDescendre={() => void deplacer(p, 1)}
          />
        ))}
      </ul>

      <form onSubmit={ajouter} className="mt-4 flex gap-2">
        <Input value={nouveau} onChange={(e) => setNouveau(e.target.value)} placeholder="Nouveau point de vente" className="h-10" />
        <Button type="submit" className="h-10" disabled={!nouveau.trim()}>
          <PlusIcon /> Ajouter
        </Button>
      </form>
    </div>
  )
}

function LignePdv({
  pdv,
  surRenommer,
  surActif,
  surMonter,
  surDescendre,
}: {
  pdv: PointDeVente
  surRenommer: (nom: string) => Promise<boolean>
  surActif: (actif: boolean) => void
  surMonter: () => void
  surDescendre: () => void
}) {
  const [nom, setNom] = useState(pdv.nom)
  const modifie = nom.trim() !== pdv.nom && nom.trim() !== ""

  return (
    <li className={cn("flex items-center gap-2 px-3 py-2", !pdv.actif && "text-muted-foreground")}>
      <div className="flex">
        <Button variant="ghost" size="icon-sm" aria-label="Monter" onClick={surMonter}>
          <ArrowUpIcon />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Descendre" onClick={surDescendre}>
          <ArrowDownIcon />
        </Button>
      </div>
      <form
        className="flex flex-1 gap-2"
        onSubmit={async (e) => {
          e.preventDefault()
          if (modifie && (await surRenommer(nom.trim()))) toast.success("Renommé")
        }}
      >
        <Input value={nom} onChange={(e) => setNom(e.target.value)} className="h-10" aria-label="Nom du point de vente" />
        {modifie && (
          <Button type="submit" size="icon" className="size-10" aria-label="Enregistrer le nom">
            <CheckIcon />
          </Button>
        )}
      </form>
      <Switch checked={pdv.actif} onCheckedChange={surActif} aria-label={pdv.actif ? "Désactiver" : "Activer"} />
    </li>
  )
}
