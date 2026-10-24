-- =============================================================
-- Row Level Security
--  vendeur   : commandes de son point de vente uniquement
--  boulanger : lecture de tout, changement de statut (préparée)
--  admin     : lecture et écriture de tout
-- =============================================================

alter table public.points_de_vente enable row level security;
alter table public.profils enable row level security;
alter table public.clients enable row level security;
alter table public.produits enable row level security;
alter table public.commandes enable row level security;
alter table public.lignes_commande enable row level security;

-- Points de vente ----------------------------------------------
create policy "pdv lecture" on public.points_de_vente
  for select to authenticated
  using ((select public.mon_role()) is not null);

create policy "pdv admin insert" on public.points_de_vente
  for insert to authenticated
  with check ((select public.mon_role()) = 'admin');

create policy "pdv admin update" on public.points_de_vente
  for update to authenticated
  using ((select public.mon_role()) = 'admin')
  with check ((select public.mon_role()) = 'admin');

create policy "pdv admin delete" on public.points_de_vente
  for delete to authenticated
  using ((select public.mon_role()) = 'admin');

-- Profils --------------------------------------------------------
create policy "profils lecture" on public.profils
  for select to authenticated
  using (id = (select auth.uid()) or (select public.mon_role()) = 'admin');

create policy "profils admin update" on public.profils
  for update to authenticated
  using ((select public.mon_role()) = 'admin')
  with check ((select public.mon_role()) = 'admin');

-- Clients --------------------------------------------------------
create policy "clients lecture" on public.clients
  for select to authenticated
  using ((select public.mon_role()) is not null);

create policy "clients insert" on public.clients
  for insert to authenticated
  with check (
    (select public.mon_role()) = 'admin'
    or ((select public.mon_role()) = 'vendeur' and type in ('regulier', 'occasionnel'))
  );

create policy "clients admin update" on public.clients
  for update to authenticated
  using ((select public.mon_role()) = 'admin')
  with check ((select public.mon_role()) = 'admin');

create policy "clients admin delete" on public.clients
  for delete to authenticated
  using ((select public.mon_role()) = 'admin');

-- Produits -------------------------------------------------------
create policy "produits lecture" on public.produits
  for select to authenticated
  using ((select public.mon_role()) is not null);

create policy "produits admin insert" on public.produits
  for insert to authenticated
  with check ((select public.mon_role()) = 'admin');

create policy "produits admin update" on public.produits
  for update to authenticated
  using ((select public.mon_role()) = 'admin')
  with check ((select public.mon_role()) = 'admin');

create policy "produits admin delete" on public.produits
  for delete to authenticated
  using ((select public.mon_role()) = 'admin');

-- Commandes ------------------------------------------------------
create policy "commandes lecture" on public.commandes
  for select to authenticated
  using (
    (select public.mon_role()) in ('admin', 'boulanger')
    or (
      (select public.mon_role()) = 'vendeur'
      and point_de_vente_id = (select public.mon_point_de_vente())
    )
  );

-- Les vendeurs passent par la fonction creer_commande()
create policy "commandes admin insert" on public.commandes
  for insert to authenticated
  with check ((select public.mon_role()) = 'admin');

-- Le trigger garde_commandes limite les colonnes et transitions par rôle
create policy "commandes update" on public.commandes
  for update to authenticated
  using (
    (select public.mon_role()) in ('admin', 'boulanger')
    or (
      (select public.mon_role()) = 'vendeur'
      and point_de_vente_id = (select public.mon_point_de_vente())
    )
  )
  with check (
    (select public.mon_role()) in ('admin', 'boulanger')
    or (
      (select public.mon_role()) = 'vendeur'
      and point_de_vente_id = (select public.mon_point_de_vente())
    )
  );

create policy "commandes admin delete" on public.commandes
  for delete to authenticated
  using ((select public.mon_role()) = 'admin');

-- Lignes de commande ---------------------------------------------
-- Visibles si la commande parente l'est (RLS de commandes appliquée)
create policy "lignes lecture" on public.lignes_commande
  for select to authenticated
  using (exists (select 1 from public.commandes c where c.id = commande_id));

create policy "lignes admin insert" on public.lignes_commande
  for insert to authenticated
  with check ((select public.mon_role()) = 'admin');

create policy "lignes admin update" on public.lignes_commande
  for update to authenticated
  using ((select public.mon_role()) = 'admin')
  with check ((select public.mon_role()) = 'admin');

create policy "lignes admin delete" on public.lignes_commande
  for delete to authenticated
  using ((select public.mon_role()) = 'admin');

-- Aucun accès anonyme
revoke all on public.points_de_vente, public.profils, public.clients, public.produits,
  public.commandes, public.lignes_commande, public.vue_ca, public.vue_ventes_produits from anon;
