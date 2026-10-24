// Crée (ou met à jour) un compte avec son rôle.
// Usage :
//   npm run creer-admin  -- patron@exemple.fr "MotDePasse123" "Guillaume"
//   npm run creer-compte -- vendeuse@exemple.fr "MotDePasse123" "Julie" vendeur Coffret
//   npm run creer-compte -- fornil@exemple.fr "MotDePasse123" "Fornil" boulanger
// Nécessite NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SECRET_KEY dans .env.local

import { createClient } from "@supabase/supabase-js"

const [email, motDePasse, nom = "Patron", role = "admin", nomPdv] = process.argv.slice(2)
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const cle = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY

function arreter(message) {
  console.error(message)
  process.exit(1)
}

if (!email || !motDePasse) arreter('Usage : npm run creer-compte -- <email> <mot de passe> "Nom" [admin|boulanger|vendeur] [point de vente]')
if (!url || !cle) arreter("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SECRET_KEY doivent être définies dans .env.local")
if (motDePasse.length < 8) arreter("Le mot de passe doit faire au moins 8 caractères.")
if (!["admin", "boulanger", "vendeur"].includes(role)) arreter(`Rôle inconnu : ${role}`)
if (role === "vendeur" && !nomPdv) arreter("Un vendeur doit avoir un point de vente (ex. Coffret).")

const supabase = createClient(url, cle, { auth: { autoRefreshToken: false, persistSession: false } })

let pointDeVenteId = null
if (role === "vendeur") {
  const { data: pdv } = await supabase.from("points_de_vente").select("id, nom").ilike("nom", nomPdv).maybeSingle()
  if (!pdv) arreter(`Point de vente introuvable : ${nomPdv}`)
  pointDeVenteId = pdv.id
}

const appMetadata = { role, point_de_vente_id: pointDeVenteId }
let { data, error } = await supabase.auth.admin.createUser({
  email,
  password: motDePasse,
  email_confirm: true,
  user_metadata: { nom },
  app_metadata: appMetadata,
})

if (error && /already been registered/i.test(error.message)) {
  // Compte existant : on le retrouve et on met à jour mot de passe et rôle.
  const { data: liste } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const existant = liste?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
  if (!existant) arreter(`Compte introuvable : ${email}`)
  ;({ data, error } = await supabase.auth.admin.updateUserById(existant.id, {
    password: motDePasse,
    app_metadata: appMetadata,
    ban_duration: "none",
  }))
}

if (error || !data?.user) arreter(`Échec : ${error?.message}`)

const { error: errProfil } = await supabase
  .from("profils")
  .upsert({ id: data.user.id, email, nom, role, point_de_vente_id: pointDeVenteId, actif: true })

if (errProfil) arreter(`Compte créé mais profil non mis à jour : ${errProfil.message}`)

console.log(`✓ Compte ${role}${nomPdv ? ` (${nomPdv})` : ""} prêt : ${email}`)
