"use client"

import { KeyRoundIcon, Loader2Icon, PlusIcon, Trash2Icon, TriangleAlertIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import {
  changerMotDePasse,
  creerUtilisateur,
  modifierUtilisateur,
  supprimerUtilisateur,
  type Resultat,
} from "@/app/admin/utilisateurs/actions"
import { EnTetePage } from "@/components/layout/EnTetePage"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn, formatDateHeure } from "@/lib/utils"
import { LIBELLES_ROLE, type PointDeVente, type Profil, type Role } from "@/types"

const ROLES: Role[] = ["vendeur", "boulanger", "admin"]

interface Props {
  moiId: string
  profils: Profil[]
  pointsDeVente: Pick<PointDeVente, "id" | "nom">[]
  connexions: Record<string, string | null>
  gestionActive: boolean
}

export function GestionUtilisateurs({ moiId, profils, pointsDeVente, connexions, gestionActive }: Props) {
  const router = useRouter()
  const [enCours, demarrer] = useTransition()
  const [creation, setCreation] = useState(false)
  const [motDePasse, setMotDePasse] = useState<Profil | null>(null)

  function executer(action: () => Promise<Resultat>, succes: string) {
    demarrer(async () => {
      const r = await action()
      if (r.ok) {
        toast.success(succes)
        router.refresh()
      } else toast.error(r.erreur ?? "Erreur")
    })
  }

  return (
    <div>
      <EnTetePage
        titre="Comptes patron"
        description="Comptes avec email et mot de passe (le patron, un associé…). Les boutiques et le fornil utilisent des appareils activés, voir « Appareils »."
        actions={
          <Button className="h-10" onClick={() => setCreation(true)} disabled={!gestionActive}>
            <PlusIcon /> Nouveau compte
          </Button>
        }
      />

      {!gestionActive && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
          <p>
            La création et la modification des comptes nécessitent la variable d&apos;environnement serveur{" "}
            <code>SUPABASE_SECRET_KEY</code> (clé secrète / service role du projet Supabase). Ajoutez-la dans{" "}
            <code>.env.local</code> et dans Vercel, puis redéployez.
          </p>
        </div>
      )}

      <div className={cn("overflow-x-auto rounded-xl border bg-background", enCours && "opacity-70")}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Point de vente</TableHead>
              <TableHead>Dernière connexion</TableHead>
              <TableHead>Actif</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {profils.map((p) => {
              const moi = p.id === moiId
              return (
                <TableRow key={p.id} className={cn(!p.actif && "text-muted-foreground")}>
                  <TableCell className="font-medium">
                    {p.nom}
                    {moi && <span className="ml-2 text-xs text-muted-foreground">(vous)</span>}
                  </TableCell>
                  <TableCell>{p.email}</TableCell>
                  <TableCell>
                    <Select
                      value={p.role ?? "aucun"}
                      disabled={!gestionActive || moi}
                      onValueChange={(v) =>
                        executer(() => modifierUtilisateur(p.id, { role: v as Role }), "Rôle mis à jour")
                      }
                    >
                      <SelectTrigger className="h-9 w-44" aria-label="Rôle">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {!p.role && (
                          <SelectItem value="aucun" disabled>
                            Sans accès
                          </SelectItem>
                        )}
                        {ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {LIBELLES_ROLE[r]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {p.role === "vendeur" ? (
                      <Select
                        value={p.point_de_vente_id ?? "aucun"}
                        disabled={!gestionActive}
                        onValueChange={(v) =>
                          executer(
                            () => modifierUtilisateur(p.id, { point_de_vente_id: v }),
                            "Point de vente mis à jour",
                          )
                        }
                      >
                        <SelectTrigger className={cn("h-9 w-40", !p.point_de_vente_id && "text-destructive")} aria-label="Point de vente">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {!p.point_de_vente_id && (
                            <SelectItem value="aucun" disabled>
                              À définir
                            </SelectItem>
                          )}
                          {pointsDeVente.map((pdv) => (
                            <SelectItem key={pdv.id} value={pdv.id}>
                              {pdv.nom}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {connexions[p.id] ? formatDateHeure(connexions[p.id]!) : "—"}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={p.actif}
                      disabled={!gestionActive || moi}
                      onCheckedChange={(v) =>
                        executer(() => modifierUtilisateur(p.id, { actif: v }), v ? "Compte réactivé" : "Compte désactivé")
                      }
                      aria-label={p.actif ? "Désactiver le compte" : "Réactiver le compte"}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex">
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={!gestionActive}
                        aria-label={`Changer le mot de passe de ${p.nom}`}
                        onClick={() => setMotDePasse(p)}
                      >
                        <KeyRoundIcon />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={!gestionActive || moi}
                        aria-label={`Supprimer ${p.nom}`}
                        onClick={() => {
                          if (window.confirm(`Supprimer définitivement le compte de ${p.nom} ? Ses commandes sont conservées.`)) {
                            executer(() => supprimerUtilisateur(p.id), "Compte supprimé")
                          }
                        }}
                      >
                        <Trash2Icon />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={creation} onOpenChange={setCreation}>
        <DialogContent className="sm:max-w-md">
          {creation && (
            <FormCreation
              pointsDeVente={pointsDeVente}
              surFin={() => {
                setCreation(false)
                router.refresh()
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={motDePasse !== null} onOpenChange={(o) => !o && setMotDePasse(null)}>
        <DialogContent className="sm:max-w-md">
          {motDePasse && <FormMotDePasse profil={motDePasse} surFin={() => setMotDePasse(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FormCreation({
  pointsDeVente,
  surFin,
}: {
  pointsDeVente: Pick<PointDeVente, "id" | "nom">[]
  surFin: () => void
}) {
  const [role, setRole] = useState<Role>("admin")
  const [pdv, setPdv] = useState(pointsDeVente[0]?.id ?? "")
  const [enCours, setEnCours] = useState(false)

  async function soumettre(formData: FormData) {
    setEnCours(true)
    formData.set("role", role)
    formData.set("point_de_vente_id", role === "vendeur" ? pdv : "")
    const r = await creerUtilisateur(formData)
    setEnCours(false)
    if (r.ok) {
      toast.success("Compte créé", { description: "Communiquez l'email et le mot de passe à la personne." })
      surFin()
    } else toast.error(r.erreur ?? "Création impossible")
  }

  return (
    <form action={soumettre} className="space-y-4">
      <DialogHeader>
        <DialogTitle>Nouveau compte</DialogTitle>
        <DialogDescription>La personne se connectera avec cet email et ce mot de passe.</DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        <Label htmlFor="u-nom">Nom</Label>
        <Input id="u-nom" name="nom" required autoFocus className="h-11" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="u-email">Email</Label>
        <Input id="u-email" name="email" type="email" required autoComplete="off" className="h-11" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="u-mdp">Mot de passe (8 caractères minimum)</Label>
        <Input id="u-mdp" name="mot_de_passe" type="text" minLength={8} required autoComplete="new-password" className="h-11" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Rôle</Label>
          <Select value={role} onValueChange={(v) => setRole(v as Role)}>
            <SelectTrigger className="h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {LIBELLES_ROLE[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {role === "vendeur" && (
          <div className="space-y-2">
            <Label>Point de vente</Label>
            <Select value={pdv} onValueChange={setPdv}>
              <SelectTrigger className="h-11 w-full">
                <SelectValue placeholder="Choisir" />
              </SelectTrigger>
              <SelectContent>
                {pointsDeVente.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <DialogFooter>
        <Button type="submit" disabled={enCours || (role === "vendeur" && !pdv)}>
          {enCours && <Loader2Icon className="animate-spin" />}
          Créer le compte
        </Button>
      </DialogFooter>
    </form>
  )
}

function FormMotDePasse({ profil, surFin }: { profil: Profil; surFin: () => void }) {
  const [valeur, setValeur] = useState("")
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e: React.FormEvent) {
    e.preventDefault()
    setEnCours(true)
    const r = await changerMotDePasse(profil.id, valeur)
    setEnCours(false)
    if (r.ok) {
      toast.success(`Mot de passe de ${profil.nom} modifié`)
      surFin()
    } else toast.error(r.erreur ?? "Erreur")
  }

  return (
    <form onSubmit={soumettre} className="space-y-4">
      <DialogHeader>
        <DialogTitle>Nouveau mot de passe</DialogTitle>
        <DialogDescription>{profil.email}</DialogDescription>
      </DialogHeader>
      <Input
        value={valeur}
        onChange={(e) => setValeur(e.target.value)}
        type="text"
        minLength={8}
        required
        autoFocus
        autoComplete="new-password"
        className="h-11"
        aria-label="Nouveau mot de passe"
      />
      <DialogFooter>
        <Button type="submit" disabled={enCours || valeur.length < 8}>
          {enCours && <Loader2Icon className="animate-spin" />}
          Enregistrer
        </Button>
      </DialogFooter>
    </form>
  )
}
