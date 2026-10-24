const TAILLE_PAGE = 1000

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>

/**
 * Récupère toutes les lignes d'une requête, page par page
 * (l'API Supabase plafonne chaque réponse à 1000 lignes).
 */
export async function toutesLesPages<T>(requete: (debut: number, fin: number) => Page<T>): Promise<T[]> {
  const lignes: T[] = []
  for (let page = 0; ; page++) {
    const { data, error } = await requete(page * TAILLE_PAGE, (page + 1) * TAILLE_PAGE - 1)
    if (error) throw new Error(error.message)
    lignes.push(...(data ?? []))
    if (!data || data.length < TAILLE_PAGE) return lignes
  }
}
