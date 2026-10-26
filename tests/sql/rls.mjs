// Tests SQL (RLS, triggers, commandes habituelles, production) sur un Postgres embarqué (PGlite).
// Lancer : npm run test:sql
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = process.argv[2] ?? fileURLToPath(new URL("../..", import.meta.url));
const db = new PGlite();

const stub = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_app_meta_data jsonb default '{}', raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid $$;
grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
create publication supabase_realtime;
`;
await db.exec(stub);
for (const f of ["20261024000001_schema.sql", "20261024000002_rls.sql", "20261024000003_vues_ca_agregees.sql", "20261024000004_index_clients.sql", "20261024000005_appareils.sql", "20261026000006_habituelles_production.sql"]) {
  await db.exec(readFileSync(`${root}/supabase/migrations/${f}`, "utf8"));
  console.log("OK migration", f);
}
await db.exec(readFileSync(`${root}/supabase/seed.sql`, "utf8"));
await db.exec(readFileSync(`${root}/supabase/seed.sql`, "utf8"));
const counts = await db.query(`select (select count(*) from points_de_vente) pdv, (select count(*) from clients) clients, (select count(*) from produits) produits`);
console.log("seed x2 counts", counts.rows[0]);

const pdv = Object.fromEntries((await db.query(`select nom, id from points_de_vente`)).rows.map((r) => [r.nom, r.id]));
const cli = Object.fromEntries((await db.query(`select nom, id from clients`)).rows.map((r) => [r.nom, r.id]));
const prod = Object.fromEntries((await db.query(`select nom, id from produits`)).rows.map((r) => [r.nom, r.id]));

const U = { admin: "00000000-0000-0000-0000-00000000000a", vendeur: "00000000-0000-0000-0000-00000000000b", boulanger: "00000000-0000-0000-0000-00000000000c", vendeur2: "00000000-0000-0000-0000-00000000000d", intrus: "00000000-0000-0000-0000-00000000000e", appareil: "00000000-0000-0000-0000-00000000000f" };
await db.query(`insert into auth.users (id, email, raw_app_meta_data) values
  ($1,'patron@x.fr','{"role":"admin"}'), ($2,'vendeuse@x.fr',$6), ($3,'fornil@x.fr','{"role":"boulanger"}'),
  ($4,'vendeuse2@x.fr',$7), ($5,'intrus@x.fr','{"role":"admin_fake"}')`,
  [U.admin, U.vendeur, U.boulanger, U.vendeur2, U.intrus,
   JSON.stringify({ role: "vendeur", point_de_vente_id: pdv.Coffret }), JSON.stringify({ role: "vendeur", point_de_vente_id: pdv.Merveille })]);
await db.query(`insert into auth.users (id, email, raw_app_meta_data) values ($1,'appareil@x.fr','{"role":"appareil"}')`, [U.appareil]);
console.log("profils", (await db.query(`select email, role, point_de_vente_id is not null as a_pdv from profils order by email`)).rows);

let ok = 0, ko = 0;
async function as(user, sql, params = []) {
  await db.exec(`reset role`);
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: U[user], role: "authenticated" })]);
  await db.exec(`set role authenticated`);
  try { return await db.query(sql, params); } finally { await db.exec(`reset role`); }
}
async function expect(label, fn, shouldFail = false) {
  try {
    const r = await fn();
    if (shouldFail) { ko++; console.log("❌ (aurait dû échouer)", label, r?.rows); } else { ok++; console.log("✅", label, r?.rows ? JSON.stringify(r.rows).slice(0, 200) : ""); }
  } catch (e) {
    if (shouldFail) { ok++; console.log("✅ refusé:", label, "→", e.message); } else { ko++; console.log("❌", label, "→", e.message); }
  }
}
function check(label, cond, info) { if (cond) { ok++; console.log("✅", label); } else { ko++; console.log("❌", label, info ?? ""); } }

const c1 = "11111111-1111-1111-1111-111111111111";
const lignes = JSON.stringify([{ produit_id: prod["Baguette tradition"], quantite: 10 }, { produit_id: prod["Croissant"], quantite: 4 }, { produit_id: prod["Brioche"], quantite: 0 }]);
await expect("vendeur crée commande (pdv forcé)", () => as("vendeur", `select creer_commande($1,$2,current_date+1,$3::jsonb,'  sans sel ',$4) as id`, [c1, cli["Armée"], lignes, pdv.Merveille]));
const cmd = (await db.query(`select * from commandes where id=$1`, [c1])).rows[0];
check("pdv forcé à Coffret", cmd.point_de_vente_id === pdv.Coffret, cmd.point_de_vente_id);
check("totaux HT = 17.60", Number(cmd.total_ht) === 17.6, cmd.total_ht);
check("totaux TTC = 18.82", Number(cmd.total_ttc) === 18.82, cmd.total_ttc);
check("notes trim", cmd.notes === "sans sel", cmd.notes);
check("cree_par = vendeur", cmd.cree_par === U.vendeur);
await expect("renvoi idempotent", () => as("vendeur", `select creer_commande($1,$2,current_date+1,$3::jsonb) as id`, [c1, cli["Armée"], lignes]));
const nbl = (await db.query(`select count(*)::int n from lignes_commande where commande_id=$1`, [c1])).rows[0].n;
check("2 lignes (pas de doublon, quantité 0 ignorée)", nbl === 2, nbl);
await expect("commande vide refusée", () => as("vendeur", `select creer_commande(gen_random_uuid(),$1,current_date,'[]'::jsonb)`, [cli["Armée"]]), true);
await expect("boulanger ne peut pas créer", () => as("boulanger", `select creer_commande(gen_random_uuid(),$1,current_date,$2::jsonb)`, [cli["Armée"], lignes]), true);
await expect("intrus (rôle invalide) ne peut pas créer", () => as("intrus", `select creer_commande(gen_random_uuid(),$1,current_date,$2::jsonb)`, [cli["Armée"], lignes]), true);

const c2 = "22222222-2222-2222-2222-222222222222";
await expect("admin crée commande à Merveille", () => as("admin", `select creer_commande($1,$2,current_date,$3::jsonb,null,$4)`, [c2, cli["Relais de châteaux"], lignes, pdv.Merveille]));

const vis = await as("vendeur", `select id from commandes`);
check("vendeur Coffret ne voit que sa commande", vis.rows.length === 1 && vis.rows[0].id === c1, vis.rows);
const vis2 = await as("vendeur2", `select id from commandes`);
check("vendeur Merveille ne voit que la sienne", vis2.rows.length === 1 && vis2.rows[0].id === c2, vis2.rows);
const visL = await as("vendeur", `select commande_id from lignes_commande`);
check("vendeur ne voit que ses lignes", visL.rows.every((r) => r.commande_id === c1) && visL.rows.length === 2, visL.rows);
const visB = await as("boulanger", `select id from commandes`);
check("boulanger voit tout", visB.rows.length === 2);
const visI = await as("intrus", `select id from commandes`);
check("intrus ne voit rien", visI.rows.length === 0);
const ca = await as("vendeur", `select * from vue_ca`);
check("vue_ca filtrée par RLS (vendeur)", ca.rows.length === 1 && Number(ca.rows[0].total_ttc) === 18.82, ca.rows);
const caA = await as("admin", `select * from vue_ca`);
check("vue_ca admin = 2 commandes", caA.rows.length === 2);
const vp = await as("admin", `select produit_nom, sum(quantite) q from vue_ventes_produits group by 1 order by 1`);
const caj = await as("vendeur", `select * from vue_ca_jour`);
check("vue_ca_jour vendeur = 1 ligne (RLS)", caj.rows.length === 1 && Number(caj.rows[0].total_ttc) === 18.82 && caj.rows[0].client_nom === "Armée", caj.rows);
const cajA = await as("admin", `select sum(nb_commandes)::int n, sum(total_ttc) t from vue_ca_jour`);
check("vue_ca_jour admin = 2 commandes", cajA.rows[0].n === 2, cajA.rows);
const vpj = await as("admin", `select * from vue_ventes_produits_jour order by produit_nom`);
check("vue_ventes_produits_jour agrégée", vpj.rows.length === 4 && vpj.rows.every((r) => Number(r.quantite) > 0), vpj.rows);
console.log("   ventes produits:", vp.rows);

await expect("boulanger marque préparée", () => as("boulanger", `update commandes set statut='preparee' where id=$1 returning statut, prepare_le is not null as horodate`, [c1]));
await expect("boulanger ne peut pas modifier les notes", () => as("boulanger", `update commandes set notes='x' where id=$1`, [c1]), true);
await expect("boulanger ne peut pas passer livrée", () => as("boulanger", `update commandes set statut='livree' where id=$1`, [c1]), true);
await expect("vendeur ne peut pas annuler une préparée", () => as("vendeur", `update commandes set statut='annulee' where id=$1`, [c1]), true);
await expect("vendeur marque livrée", () => as("vendeur", `update commandes set statut='livree' where id=$1 returning statut`, [c1]));
const upd = await as("vendeur", `update commandes set statut='annulee' where id=$1 returning id`, [c2]);
check("vendeur ne peut pas toucher une commande d'un autre pdv (0 ligne)", upd.rows.length === 0);
await expect("admin peut tout modifier", () => as("admin", `update commandes set notes='modifié', statut='en_attente' where id=$1 returning statut, prepare_le`, [c1]));
await expect("vendeur ne peut pas insérer en direct", () => as("vendeur", `insert into commandes (client_id, date_livraison, point_de_vente_id) values ($1, current_date, $2)`, [cli["Armée"], pdv.Coffret]), true);
await expect("vendeur ne peut pas insérer de ligne", () => as("vendeur", `insert into lignes_commande (commande_id, produit_id, quantite, prix_unitaire_ht, tva) values ($1,$2,1,0,5.5)`, [c1, prod["Croissant"]]), true);

await expect("vendeur ajoute un particulier", () => as("vendeur", `insert into clients (id, nom, telephone, type) values (gen_random_uuid(), 'Mme Dupont', '0601020304', 'regulier') on conflict do nothing returning nom, cree_par`));
await expect("vendeur ne peut pas créer un client professionnel", () => as("vendeur", `insert into clients (nom, type) values ('Faux', 'professionnel')`), true);
await expect("vendeur ne peut pas modifier un produit", async () => { const r = await as("vendeur", `update produits set prix_ht=0 returning id`); if (r.rows.length) throw new Error("modifié!"); return r; });
await expect("vendeur ne peut pas changer son rôle", async () => { const r = await as("vendeur", `update profils set role='admin' returning id`); if (r.rows.length) throw new Error("modifié!"); return r; });
const prof = await as("vendeur", `select email from profils`);
check("vendeur ne lit que son profil", prof.rows.length === 1);
await expect("prix figés : changement catalogue n'affecte pas la commande", async () => {
  await as("admin", `update produits set prix_ht = 9.99 where nom='Baguette tradition'`);
  const r = await db.query(`select total_ht from commandes where id=$1`, [c1]);
  if (Number(r.rows[0].total_ht) !== 17.6) throw new Error("total changé: " + r.rows[0].total_ht);
  return r;
});
await expect("admin supprime commande (cascade lignes)", () => as("admin", `delete from commandes where id=$1 returning id`, [c2]));
const pub = await db.query(`select tablename from pg_publication_tables where pubname='supabase_realtime'`);
check("realtime publication", pub.rows.length >= 2, pub.rows);
await expect("anon ne lit rien", async () => { await db.exec(`set role anon`); try { return await db.query(`select * from commandes`); } finally { await db.exec(`reset role`); } }, true);

// --- Appareils ---
const c3 = "33333333-3333-3333-3333-333333333333";
await expect("appareil sans boutique refusé", () => as("appareil", `select creer_commande(gen_random_uuid(),$1,current_date,$2::jsonb)`, [cli["Armée"], lignes]), true);
await expect("appareil crée commande pour Lermberg", () => as("appareil", `select creer_commande($1,$2,current_date,$3::jsonb,null,$4)`, [c3, cli["Armée"], lignes, pdv.Lermberg]));
const c3r = (await db.query(`select point_de_vente_id from commandes where id=$1`, [c3])).rows[0];
check("commande appareil à Lermberg", c3r.point_de_vente_id === pdv.Lermberg);
const visApp = await as("appareil", `select count(*)::int n from commandes`);
check("appareil voit toutes les commandes", visApp.rows[0].n >= 2, visApp.rows);
await expect("appareil marque préparée", () => as("appareil", `update commandes set statut='preparee' where id=$1 returning statut`, [c3]));
await expect("appareil marque livrée", () => as("appareil", `update commandes set statut='livree' where id=$1 returning statut`, [c3]));
await expect("appareil ne modifie pas les notes", () => as("appareil", `update commandes set notes='x' where id=$1`, [c3]), true);
await expect("appareil ajoute un particulier", () => as("appareil", `insert into clients (nom, type) values ('App Client', 'occasionnel') returning nom`));
await expect("appareil ne crée pas de client pro", () => as("appareil", `insert into clients (nom, type) values ('X', 'professionnel')`), true);
await expect("appareil ne lit pas les codes", () => as("appareil", `select * from codes_activation`), true);
await expect("admin ne lit pas les codes en direct", () => as("admin", `select * from codes_activation`), true);
await expect("appareil ne modifie pas les produits", async () => { const r = await as("appareil", `update produits set prix_ht=0 returning id`); if (r.rows.length) throw new Error("modifié"); return r; });
// --- Commandes habituelles ---
const rec = "44444444-4444-4444-4444-444444444444";
const jourAuj = (await db.query(`select extract(isodow from (now() at time zone 'Europe/Paris')::date)::int j`)).rows[0].j;
await expect("vendeur crée une habituelle (aujourd'hui + mercredi)", () => as("vendeur", `select creer_commande($1,$2,(now() at time zone 'Europe/Paris')::date,$3::jsonb,'habitude',null,$4::smallint[])`, [rec, cli["Coffret"], lignes, [jourAuj, 3]]));
const nbRec = (await db.query(`select count(*)::int n from commandes_recurrentes`)).rows[0].n;
check("1 ou 2 habitudes créées (jours distincts)", nbRec === (jourAuj === 3 ? 1 : 2), nbRec);
const gen = (await db.query(`select count(*)::int n, min(date_livraison) d from commandes where recurrente_id is not null`)).rows[0];
check("occurrences générées sur 15 jours", gen.n >= 3 && gen.n <= 5, gen);
const pdvGen = (await db.query(`select distinct point_de_vente_id from commandes where recurrente_id is not null`)).rows;
check("habituelle forcée au pdv du vendeur", pdvGen.length === 1 && pdvGen[0].point_de_vente_id === pdv.Coffret);
const tot = (await db.query(`select distinct total_ht from commandes where recurrente_id is not null`)).rows;
check("lignes et totaux générés", tot.length === 1 && Number(tot[0].total_ht) > 0, tot);
await expect("renvoi idempotent de l'habituelle", () => as("vendeur", `select creer_commande($1,$2,current_date,$3::jsonb,null,null,$4::smallint[])`, [rec, cli["Coffret"], lignes, [jourAuj]]));
check("pas de doublon d'habitude", (await db.query(`select count(*)::int n from commandes_recurrentes`)).rows[0].n === nbRec);
const re = await as("fornil" in U ? "boulanger" : "boulanger", `select generer_recurrences(current_date + 14) n`);
check("regénération idempotente (0 nouvelle)", re.rows[0].n === 0, re.rows);
const prem = (await db.query(`select id from commandes where recurrente_id=$1 order by date_livraison limit 1`, [rec])).rows[0].id;
await expect("vendeur annule une seule semaine", () => as("vendeur", `update commandes set statut='annulee' where id=$1 returning statut`, [prem]));
await as("boulanger", `select generer_recurrences(current_date + 14)`);
check("semaine annulée non recréée", (await db.query(`select statut from commandes where id=$1`, [prem])).rows[0].statut === "annulee");
await expect("vendeur Merveille ne peut pas arrêter une habitude Coffret", () => as("vendeur2", `select arreter_recurrence($1)`, [rec]), true);
await expect("boulanger ne peut pas arrêter une habitude", () => as("boulanger", `select arreter_recurrence($1)`, [rec]), true);
await expect("vendeur ne crée pas d'habitude en direct", () => as("vendeur", `insert into commandes_recurrentes (client_id, jour_semaine, lignes, date_debut) values ($1, 1, '[]', current_date)`, [cli["Coffret"]]), true);
const visRec = await as("vendeur2", `select count(*)::int n from commandes_recurrentes`);
check("vendeur Merveille ne voit pas les habitudes Coffret", visRec.rows[0].n === 0);
await expect("vendeur arrête son habitude", () => as("vendeur", `select arreter_recurrence($1) n`, [rec]));
const restantes = (await db.query(`select count(*)::int n from commandes where recurrente_id=$1 and statut='en_attente'`, [rec])).rows[0].n;
check("prochaines occurrences annulées", restantes === 0, restantes);
await as("boulanger", `select generer_recurrences(current_date + 30)`);
check("habitude arrêtée : plus de génération", (await db.query(`select count(*)::int n from commandes where recurrente_id=$1 and statut='en_attente'`, [rec])).rows[0].n === 0);
await expect("appareil crée une habituelle pour Lermberg", () => as("appareil", `select creer_commande(gen_random_uuid(),$1,current_date+1,$2::jsonb,null,$3,'{7}'::smallint[])`, [cli["Lermberg"], lignes, pdv.Lermberg]));
// --- Production ---
await expect("boulanger note la production", () => as("boulanger", `insert into production_faite (date_production, produit_id, quantite) values (current_date, $1, 20) on conflict (date_production, produit_id) do update set quantite = excluded.quantite returning quantite`, [prod["Croissant"]]));
await expect("appareil met à jour la production", () => as("appareil", `update production_faite set quantite = 25 where produit_id=$1 returning quantite`, [prod["Croissant"]]));
await expect("vendeur ne touche pas à la production", () => as("vendeur", `insert into production_faite (date_production, produit_id, quantite) values (current_date+1, $1, 1)`, [prod["Croissant"]]), true);
await expect("vendeur crée un client tournée", () => as("vendeur", `insert into clients (nom, type) values ('Tournée test', 'tournee') returning type`));
await expect("vendeur ne crée pas de client pro", () => as("vendeur", `insert into clients (nom, type) values ('Pro', 'professionnel')`), true);
await expect("anon ne lit pas les habitudes", async () => { await db.exec(`set role anon`); try { return await db.query(`select * from commandes_recurrentes`); } finally { await db.exec(`reset role`); } }, true);
console.log(`\n${ok} OK, ${ko} KO`);
process.exit(ko ? 1 : 0);
