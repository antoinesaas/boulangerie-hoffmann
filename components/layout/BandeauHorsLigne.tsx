"use client"

import { CloudOffIcon, RefreshCwIcon } from "lucide-react"
import { useEnLigne, useSynchroAuto } from "@/lib/hooks/useFileAttente"
import { synchroniser } from "@/lib/offline/fileAttente"

/** Bandeau d'état réseau + relance automatique de la file d'attente hors ligne. */
export function BandeauHorsLigne() {
  const enLigne = useEnLigne()
  const file = useSynchroAuto()
  const enAttente = file.filter((o) => !o.erreur && o.type === "commande").length
  const enErreur = file.filter((o) => o.erreur).length

  if (enLigne && enAttente === 0 && enErreur === 0) return null

  return (
    <div
      role="status"
      className={
        enLigne
          ? "flex items-center gap-2 bg-amber-100 px-4 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100"
          : "flex items-center gap-2 bg-neutral-900 px-4 py-2 text-sm text-white dark:bg-neutral-100 dark:text-neutral-900"
      }
    >
      {!enLigne && <CloudOffIcon className="size-4 shrink-0" />}
      <span className="flex-1">
        {!enLigne && "Hors ligne. "}
        {enAttente > 0 &&
          `${enAttente} commande${enAttente > 1 ? "s" : ""} en attente d'envoi${enLigne ? "" : " : envoi automatique au retour du réseau"}.`}
        {enErreur > 0 && ` ${enErreur} envoi${enErreur > 1 ? "s" : ""} refusé${enErreur > 1 ? "s" : ""} (voir Mes commandes).`}
        {!enLigne && enAttente === 0 && enErreur === 0 && "Les commandes saisies seront envoyées dès le retour du réseau."}
      </span>
      {enLigne && enAttente > 0 && (
        <button
          type="button"
          onClick={() => void synchroniser()}
          className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 font-medium underline-offset-4 hover:underline"
        >
          <RefreshCwIcon className="size-4" /> Renvoyer
        </button>
      )}
    </div>
  )
}
