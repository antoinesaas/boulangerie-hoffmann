import { ArrowDownRightIcon, ArrowUpRightIcon, MinusIcon } from "lucide-react"
import { cn, formatPourcent } from "@/lib/utils"

interface Props {
  libelle: string
  valeur: string
  detail?: React.ReactNode
  /** Variation en % (hausse = bonne nouvelle pour un CA). */
  variation?: number | null
  libelleVariation?: string
  principal?: boolean
  className?: string
}

/** Tuile chiffre clé : libellé · valeur · variation signée vs une période nommée. */
export function KpiCard({ libelle, valeur, detail, variation, libelleVariation, principal, className }: Props) {
  const a = variation !== undefined
  const sens = variation == null || Math.abs(variation) < 0.05 ? 0 : variation > 0 ? 1 : -1
  const Icone = sens > 0 ? ArrowUpRightIcon : sens < 0 ? ArrowDownRightIcon : MinusIcon

  return (
    <div className={cn("rounded-xl border bg-card p-5", className)}>
      <div className="text-sm text-muted-foreground">{libelle}</div>
      <div className={cn("mt-1 font-semibold tracking-tight", principal ? "text-5xl" : "text-3xl")}>{valeur}</div>
      {a && variation === null && (
        <div className="mt-2 text-sm text-muted-foreground">{libelleVariation ? `${libelleVariation} : ` : ""}pas de comparaison</div>
      )}
      {a && variation !== null && (
        <div
          className="mt-2 inline-flex items-center gap-1 text-sm font-medium"
          style={{ color: sens > 0 ? "var(--viz-hausse)" : sens < 0 ? "var(--viz-baisse)" : undefined }}
        >
          <Icone className="size-4" aria-hidden />
          {formatPourcent(variation ?? null)}
          {libelleVariation && <span className="font-normal text-muted-foreground">{libelleVariation}</span>}
        </div>
      )}
      {detail && <div className="mt-2 text-sm text-muted-foreground">{detail}</div>}
    </div>
  )
}
