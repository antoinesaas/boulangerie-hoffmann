// Toutes les dates métier sont des chaînes ISO "YYYY-MM-DD" en heure de Paris.
// Les calculs se font en UTC sur ces chaînes pour éviter les décalages d'heure d'été.

export const FUSEAU = "Europe/Paris"

const formateurISO = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSEAU,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

export function aujourdhui(): string {
  return formateurISO.format(new Date())
}

function versDate(iso: string): Date {
  const [a, m, j] = iso.split("-").map(Number)
  return new Date(Date.UTC(a, m - 1, j))
}

function versISO(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function ajouterJours(iso: string, jours: number): string {
  const d = versDate(iso)
  d.setUTCDate(d.getUTCDate() + jours)
  return versISO(d)
}

/** Lundi de la semaine contenant `iso`. */
export function debutSemaine(iso: string): string {
  const d = versDate(iso)
  const jour = (d.getUTCDay() + 6) % 7 // lundi = 0
  return ajouterJours(iso, -jour)
}

export function finSemaine(iso: string): string {
  return ajouterJours(debutSemaine(iso), 6)
}

export function debutMois(iso: string): string {
  return `${iso.slice(0, 7)}-01`
}

export function finMois(iso: string): string {
  const d = versDate(debutMois(iso))
  d.setUTCMonth(d.getUTCMonth() + 1)
  d.setUTCDate(0)
  return versISO(d)
}

export function joursEntre(debut: string, fin: string): string[] {
  const jours: string[] = []
  for (let j = debut; j <= fin; j = ajouterJours(j, 1)) jours.push(j)
  return jours
}

const formateurLong = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
})
const formateurCourt = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
})
const formateurJourMois = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", timeZone: "UTC" })
const formateurHeure = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: FUSEAU })
const formateurDateHeure = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: FUSEAU,
})

/** "samedi 24 octobre" */
export function formatDate(iso: string): string {
  return formateurLong.format(versDate(iso))
}

/** "sam. 24 oct." */
export function formatDateCourte(iso: string): string {
  return formateurCourt.format(versDate(iso))
}

/** "24/10" */
export function formatJourMois(iso: string): string {
  return formateurJourMois.format(versDate(iso))
}

/** Heure locale d'un timestamptz : "06:42" */
export function formatHeure(timestamp: string): string {
  return formateurHeure.format(new Date(timestamp))
}

/** "24/10 06:42" */
export function formatDateHeure(timestamp: string): string {
  return formateurDateHeure.format(new Date(timestamp))
}

/** Libellé relatif : Aujourd'hui / Demain / Hier / date. */
export function libelleJour(iso: string, reference = aujourdhui()): string {
  if (iso === reference) return "Aujourd'hui"
  if (iso === ajouterJours(reference, 1)) return "Demain"
  if (iso === ajouterJours(reference, -1)) return "Hier"
  return formatDateCourte(iso)
}
