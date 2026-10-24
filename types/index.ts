// =============================================================
// Types globaux — Boulangerie Hoffmann
// =============================================================

export type Role = "vendeur" | "boulanger" | "admin"

export type StatutCommande = "en_attente" | "preparee" | "livree" | "annulee"

export type TypeClientPro = "point_de_vente" | "tournee" | "marche" | "professionnel"
export type TypeClientParticulier = "regulier" | "occasionnel"
export type TypeClient = TypeClientPro | TypeClientParticulier

export type Unite = "pièce" | "kg" | "douzaine"
export type Categorie = "pain" | "viennoiserie" | "pâtisserie" | "autre"
export type TauxTVA = 5.5 | 10

// Tables -------------------------------------------------------

export interface PointDeVente {
  id: string
  nom: string
  ordre: number
  actif: boolean
  created_at: string
}

export interface Profil {
  id: string
  email: string | null
  nom: string
  role: Role | null
  point_de_vente_id: string | null
  actif: boolean
  created_at: string
}

export interface Client {
  id: string
  nom: string
  telephone: string | null
  type: TypeClient
  note: string | null
  actif: boolean
  cree_par: string | null
  created_at: string
}

export interface Produit {
  id: string
  nom: string
  unite: Unite
  prix_ht: number
  tva: TauxTVA
  categorie: Categorie
  ordre: number
  actif: boolean
  created_at: string
}

export interface Commande {
  id: string
  client_id: string
  point_de_vente_id: string | null
  date_livraison: string
  statut: StatutCommande
  notes: string | null
  cree_par: string | null
  cree_le: string
  prepare_le: string | null
  total_ht: number
  total_ttc: number
}

export interface LigneCommande {
  id: string
  commande_id: string
  produit_id: string
  quantite: number
  prix_unitaire_ht: number
  tva: number
}

// Jointures utilisées par l'UI ----------------------------------

export interface LigneCommandeDetail extends LigneCommande {
  produit: Pick<Produit, "id" | "nom" | "unite" | "categorie" | "ordre"> | null
}

export interface CommandeDetail extends Commande {
  client: Pick<Client, "id" | "nom" | "type" | "telephone"> | null
  point_de_vente: Pick<PointDeVente, "id" | "nom"> | null
  lignes: LigneCommandeDetail[]
}

// Vues CA --------------------------------------------------------

export interface LigneVueCA {
  id: string
  date_livraison: string
  statut: StatutCommande
  client_id: string
  client_nom: string
  client_type: TypeClient
  point_de_vente_id: string | null
  point_de_vente: string | null
  total_ht: number
  total_ttc: number
}

export interface LigneVenteProduit {
  id: string
  date_livraison: string
  statut: StatutCommande
  produit_id: string
  produit_nom: string
  unite: Unite
  categorie: Categorie
  quantite: number
  total_ht: number
  total_ttc: number
}

/** vue_ca_jour : agrégat jour × statut × point de vente × segment client */
export interface LigneCAJour {
  date_livraison: string
  statut: StatutCommande
  point_de_vente_id: string | null
  point_de_vente: string | null
  client_type: TypeClient
  client_id: string | null
  client_nom: string | null
  nb_commandes: number
  total_ht: number
  total_ttc: number
}

/** vue_ventes_produits_jour : agrégat jour × statut × produit */
export interface LigneVenteProduitJour {
  date_livraison: string
  statut: StatutCommande
  produit_id: string
  produit_nom: string
  unite: Unite
  categorie: Categorie
  quantite: number
  total_ht: number
  total_ttc: number
}

// Saisie & hors ligne --------------------------------------------

export interface LignePayload {
  produit_id: string
  quantite: number
}

export interface CommandePayload {
  p_id: string
  p_client_id: string
  p_date_livraison: string
  p_lignes: LignePayload[]
  p_notes: string | null
  p_point_de_vente_id: string | null
}

export interface NouveauClientPayload {
  id: string
  nom: string
  telephone: string | null
  type: TypeClientParticulier
}

export type OperationEnAttente =
  | {
      type: "client"
      id: string
      data: NouveauClientPayload
      creeLe: string
      erreur?: string
    }
  | {
      type: "commande"
      id: string
      data: CommandePayload
      resume: { client: string; total_ttc: number; nb_articles: number }
      creeLe: string
      erreur?: string
    }

// Libellés -------------------------------------------------------

export const LIBELLES_ROLE: Record<Role, string> = {
  vendeur: "Vendeur",
  boulanger: "Boulanger (fornil)",
  admin: "Patron / Admin",
}

export const LIBELLES_STATUT: Record<StatutCommande, string> = {
  en_attente: "En attente",
  preparee: "Préparée",
  livree: "Livrée",
  annulee: "Annulée",
}

export const LIBELLES_TYPE_CLIENT: Record<TypeClient, string> = {
  point_de_vente: "Point de vente",
  tournee: "Tournée",
  marche: "Marché",
  professionnel: "Professionnel",
  regulier: "Particulier régulier",
  occasionnel: "Particulier occasionnel",
}

export const LIBELLES_CATEGORIE: Record<Categorie, string> = {
  pain: "Pains",
  viennoiserie: "Viennoiseries",
  pâtisserie: "Pâtisseries",
  autre: "Autres",
}

export const TYPES_CLIENT_PRO: TypeClientPro[] = ["point_de_vente", "tournee", "marche", "professionnel"]
export const TYPES_CLIENT_PARTICULIER: TypeClientParticulier[] = ["regulier", "occasionnel"]
export const TYPES_LIVRAISON: TypeClient[] = ["tournee", "marche", "professionnel"]
export const CATEGORIES: Categorie[] = ["pain", "viennoiserie", "pâtisserie", "autre"]
export const UNITES: Unite[] = ["pièce", "kg", "douzaine"]
export const TAUX_TVA: TauxTVA[] = [5.5, 10]
