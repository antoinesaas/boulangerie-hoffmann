import { cn } from "@/lib/utils"
import { LIBELLES_STATUT, type StatutCommande } from "@/types"

const STYLES: Record<StatutCommande, string> = {
  en_attente: "bg-amber-100 text-amber-900 ring-amber-300 dark:bg-amber-500/20 dark:text-amber-200 dark:ring-amber-500/40",
  preparee: "bg-emerald-100 text-emerald-900 ring-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-200 dark:ring-emerald-500/40",
  livree: "bg-sky-100 text-sky-900 ring-sky-300 dark:bg-sky-500/20 dark:text-sky-200 dark:ring-sky-500/40",
  annulee: "bg-neutral-100 text-neutral-500 line-through ring-neutral-300 dark:bg-neutral-800 dark:text-neutral-400 dark:ring-neutral-700",
}

export function BadgeStatut({ statut, className }: { statut: StatutCommande; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset whitespace-nowrap",
        STYLES[statut],
        className,
      )}
    >
      {LIBELLES_STATUT[statut]}
    </span>
  )
}
