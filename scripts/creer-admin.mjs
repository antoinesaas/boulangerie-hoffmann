// Crée (ou promeut) un compte patron/admin.
// Usage : npm run creer-admin -- patron@exemple.fr "MotDePasse123" "Guillaume"
// Nécessite NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SECRET_KEY dans .env.local

import { createClient } from "@supabase/supabase-js"

const [email, motDePasse, nom = "Patron"] = process.argv.slice(2)
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const cle = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY

if (!email || !motDePasse) {
  console.error('Usage : npm run creer-admin -- <email> <mot de passe> ["Nom"]')
  process.exit(1)
}
if (!url || !cle) {
  console.error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SECRET_KEY doivent être définies dans .env.local")
  process.exit(1)
}
if (motDePasse.length < 8) {
  console.error("Le mot de passe doit faire au moins 8 caractères.")
  process.exit(1)
}

const supabase = createClient(url, cle, { auth: { autoRefreshToken: false, persistSession: false } })

let { data, error } = await supabase.auth.admin.createUser({
  email,
  password: motDePasse,
  email_confirm: true,
  user_metadata: { nom },
  app_metadata: { role: "admin" },
})

if (error && /already been registered/i.test(error.message)) {
  // Compte existant : on le retrouve et on le promeut admin.
  const { data: liste } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const existant = liste?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
  if (!existant) {
    console.error("Compte introuvable :", email)
    process.exit(1)
  }
  ;({ data, error } = await supabase.auth.admin.updateUserById(existant.id, {
    password: motDePasse,
    app_metadata: { role: "admin" },
  }))
}

if (error || !data?.user) {
  console.error("Échec :", error?.message)
  process.exit(1)
}

const { error: errProfil } = await supabase
  .from("profils")
  .upsert({ id: data.user.id, email, nom, role: "admin", point_de_vente_id: null, actif: true })

if (errProfil) {
  console.error("Compte créé mais profil non mis à jour :", errProfil.message)
  process.exit(1)
}

console.log(`✓ Compte patron prêt : ${email}`)
