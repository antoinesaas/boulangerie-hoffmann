"use client"

import { KeyRoundIcon, Loader2Icon, SmartphoneIcon, Trash2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import { desactiverAppareil, genererCode, type ResultatCode } from "@/app/admin/appareils/actions"
import { EnTetePage } from "@/components/layout/EnTetePage"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatDateHeure } from "@/lib/utils"
import type { Profil } from "@/types"

const SUGGESTIONS = ["Téléphone Coffret", "Téléphone Merveille", "Téléphone Lermberg", "Tablette fornil"]

export function GestionAppareils({ appareils, gestionActive }: { appareils: Profil[]; gestionActive: boolean }) {
  const router = useRouter()
  const [nom, setNom] = useState("")
  const [code, setCode] = useState<Extract<ResultatCode, { ok: true }> | null>(null)
  const [enCours, demarrer] = useTransition()

  function generer() {
    demarrer(async () => {
      const r = await genererCode(nom)
      if (r.ok) {
        setCode(r)
        setNom("")
      } else toast.error(r.erreur)
    })
  }

  function desactiver(p: Profil) {
    if (!window.confirm(`Désactiver « ${p.nom} » ? Il faudra un nouveau code pour le réactiver.`)) return
    demarrer(async () => {
      const r = await desactiverAppareil(p.id)
      if (r.ok) {
        toast.success(`${p.nom} désactivé`)
        router.refresh()
      } else toast.error(r.erreur ?? "Erreur")
    })
  }

  return (
    <div className="max-w-3xl space-y-6">
      <EnTetePage
        titre="Appareils"
        description="Téléphones des boutiques et tablette du fornil. Chaque appareil est activé une seule fois avec un code, puis n'a plus besoin de mot de passe."
      />

      {!gestionActive && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          La clé secrète Supabase (SUPABASE_SECRET_KEY) manque sur le serveur : l&apos;activation est indisponible.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRoundIcon className="size-5" /> Activer un nouvel appareil
          </CardTitle>
          <CardDescription>
            1. Sur l&apos;appareil, installez l&apos;app et ouvrez-la. 2. Ici, générez un code. 3. Tapez le code sur
            l&apos;appareil.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {code ? (
            <CodeAffiche resultat={code} surTermine={() => {
              setCode(null)
              router.refresh()
            }} />
          ) : (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault()
                generer()
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="nom-appareil">Nom de l&apos;appareil</Label>
                <Input
                  id="nom-appareil"
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  placeholder="Téléphone Coffret"
                  className="h-11"
                  required
                />
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setNom(s)}
                      className="min-h-9 rounded-full border px-3 text-sm hover:bg-muted"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <Button type="submit" className="h-11" disabled={enCours || !nom.trim() || !gestionActive}>
                {enCours && <Loader2Icon className="animate-spin" />}
                Générer un code d&apos;activation
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appareils activés ({appareils.length})</CardTitle>
          <CardDescription>Un appareil perdu ou remplacé ? Désactivez-le : il perd l&apos;accès immédiatement.</CardDescription>
        </CardHeader>
        <CardContent>
          {appareils.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Aucun appareil activé pour l&apos;instant.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {appareils.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                  <SmartphoneIcon className="size-5 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{p.nom}</div>
                    <div className="text-xs text-muted-foreground">Activé le {formatDateHeure(p.created_at)}</div>
                  </div>
                  <Button
                    variant="ghost"
                    className="h-10 text-destructive"
                    disabled={enCours || !gestionActive}
                    onClick={() => desactiver(p)}
                  >
                    <Trash2Icon /> Désactiver
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function CodeAffiche({
  resultat,
  surTermine,
}: {
  resultat: Extract<ResultatCode, { ok: true }>
  surTermine: () => void
}) {
  const [maintenant, setMaintenant] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setMaintenant(Date.now()), 1_000)
    return () => clearInterval(t)
  }, [])
  const reste = Math.max(0, Math.round((Date.parse(resultat.expireLe) - maintenant) / 1000))
  const minutes = Math.floor(reste / 60)
  const secondes = String(reste % 60).padStart(2, "0")

  return (
    <div className="space-y-4 text-center">
      <p className="text-sm text-muted-foreground">
        Code pour <strong className="text-foreground">{resultat.nom}</strong>
      </p>
      <p className="font-mono text-5xl font-bold tracking-[0.3em]" aria-label={`Code ${resultat.code.split("").join(" ")}`}>
        {reste > 0 ? `${resultat.code.slice(0, 3)} ${resultat.code.slice(3)}` : "expiré"}
      </p>
      <p className="text-sm text-muted-foreground">
        {reste > 0 ? `Valable encore ${minutes}:${secondes} · une seule utilisation` : "Générez-en un nouveau."}
      </p>
      <Button variant="outline" onClick={surTermine}>
        Terminé
      </Button>
    </div>
  )
}
