const formateurPrix = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" })
const formateurNombre = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 })
const formateurPourcent = new Intl.NumberFormat("fr-FR", {
  style: "percent",
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
})

export function formatPrix(valeur: number | null | undefined): string {
  return formateurPrix.format(valeur ?? 0)
}

export function formatQuantite(valeur: number): string {
  return formateurNombre.format(valeur)
}

/** 12.5 -> "+12,5 %" */
export function formatPourcent(valeur: number | null): string {
  if (valeur === null || !Number.isFinite(valeur)) return "—"
  return formateurPourcent.format(valeur / 100)
}

export function formatTVA(tva: number): string {
  return `${formateurNombre.format(tva)} %`
}

export function formatUnite(unite: string, quantite = 2): string {
  if (unite === "pièce") return quantite > 1 ? "pièces" : "pièce"
  if (unite === "douzaine") return quantite > 1 ? "douzaines" : "douzaine"
  return unite
}
