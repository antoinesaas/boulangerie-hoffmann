-- =============================================================
-- Boulangerie Guillaume — schéma principal
-- =============================================================

-- Points de vente ---------------------------------------------
create table public.points_de_vente (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  ordre integer not null default 0,
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

-- Profils utilisateurs (1 ligne par compte auth) ----------------
-- role null = compte sans accès
create table public.profils (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  nom text not null default '',
  role text check (role in ('vendeur', 'boulanger', 'admin')),
  point_de_vente_id uuid references public.points_de_vente (id) on delete set null,
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

create index profils_point_de_vente_idx on public.profils (point_de_vente_id);

-- Clients (pros + particuliers) ---------------------------------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  telephone text,
  type text not null check (
    type in ('point_de_vente', 'tournee', 'marche', 'professionnel', 'regulier', 'occasionnel')
  ),
  note text,
  actif boolean not null default true,
  cree_par uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index clients_nom_idx on public.clients (lower(nom));

-- Produits -------------------------------------------------------
create table public.produits (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  unite text not null default 'pièce' check (unite in ('pièce', 'kg', 'douzaine')),
  prix_ht numeric(10, 2) not null default 0 check (prix_ht >= 0),
  tva numeric(4, 2) not null default 5.5 check (tva in (5.5, 10)),
  categorie text not null default 'pain' check (categorie in ('pain', 'viennoiserie', 'pâtisserie', 'autre')),
  ordre integer not null default 0,
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

-- Commandes ------------------------------------------------------
-- total_ht / total_ttc sont maintenus par trigger à partir des lignes
create table public.commandes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id),
  point_de_vente_id uuid references public.points_de_vente (id),
  date_livraison date not null,
  statut text not null default 'en_attente' check (statut in ('en_attente', 'preparee', 'livree', 'annulee')),
  notes text,
  cree_par uuid references auth.users (id) on delete set null default auth.uid(),
  cree_le timestamptz not null default now(),
  prepare_le timestamptz,
  total_ht numeric(10, 2) not null default 0,
  total_ttc numeric(10, 2) not null default 0
);

create index commandes_date_idx on public.commandes (date_livraison);
create index commandes_pdv_date_idx on public.commandes (point_de_vente_id, date_livraison);
create index commandes_client_idx on public.commandes (client_id);
create index commandes_cree_par_idx on public.commandes (cree_par);

-- Lignes de commande ---------------------------------------------
-- prix_unitaire_ht et tva sont figés au moment de la commande
create table public.lignes_commande (
  id uuid primary key default gen_random_uuid(),
  commande_id uuid not null references public.commandes (id) on delete cascade,
  produit_id uuid not null references public.produits (id),
  quantite numeric(10, 3) not null check (quantite > 0),
  prix_unitaire_ht numeric(10, 2) not null,
  tva numeric(4, 2) not null
);

create index lignes_commande_commande_idx on public.lignes_commande (commande_id);
create index lignes_commande_produit_idx on public.lignes_commande (produit_id);

-- =============================================================
-- Fonctions utilitaires (rôle courant)
-- =============================================================

create or replace function public.mon_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profils where id = (select auth.uid()) and actif
$$;

create or replace function public.mon_point_de_vente()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select point_de_vente_id from public.profils where id = (select auth.uid()) and actif
$$;

-- Création automatique du profil à l'inscription d'un compte.
-- Le rôle n'est lu que depuis app_metadata (non modifiable par l'utilisateur).
create or replace function public.gerer_nouvel_utilisateur()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := new.raw_app_meta_data ->> 'role';
  v_pdv text := new.raw_app_meta_data ->> 'point_de_vente_id';
begin
  insert into public.profils (id, email, nom, role, point_de_vente_id)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'nom', ''), split_part(new.email, '@', 1)),
    case when v_role in ('vendeur', 'boulanger', 'admin') then v_role end,
    case when v_pdv ~ '^[0-9a-f-]{36}$' then v_pdv::uuid end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.gerer_nouvel_utilisateur();

-- Recalcul des totaux d'une commande quand ses lignes changent
create or replace function public.recalculer_total_commande()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_commande_id uuid;
begin
  if tg_op = 'DELETE' then
    v_commande_id := old.commande_id;
  else
    v_commande_id := new.commande_id;
  end if;

  update public.commandes c
  set
    total_ht = coalesce(t.ht, 0),
    total_ttc = coalesce(t.ttc, 0)
  from (
    select
      round(sum(quantite * prix_unitaire_ht), 2) as ht,
      round(sum(quantite * prix_unitaire_ht * (1 + tva / 100)), 2) as ttc
    from public.lignes_commande
    where commande_id = v_commande_id
  ) t
  where c.id = v_commande_id;
  return null;
end;
$$;

create trigger lignes_commande_totaux
  after insert or update or delete on public.lignes_commande
  for each row execute function public.recalculer_total_commande();

-- Garde-fou sur les mises à jour de commandes :
--  * horodate la préparation
--  * boulanger : uniquement en_attente <-> preparee
--  * vendeur   : uniquement -> livree, ou en_attente -> annulee
--  * admin     : tout
-- Les fonctions security definer (current_user <> 'authenticated') ne sont pas bridées.
create or replace function public.garde_commandes()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_role text;
begin
  if new.statut = 'preparee' and old.statut is distinct from 'preparee' then
    new.prepare_le := now();
  elsif new.statut = 'en_attente' then
    new.prepare_le := null;
  end if;

  if current_user <> 'authenticated' then
    return new;
  end if;

  v_role := public.mon_role();
  if v_role = 'admin' then
    return new;
  end if;

  if (to_jsonb(new) - 'statut' - 'prepare_le') is distinct from (to_jsonb(old) - 'statut' - 'prepare_le') then
    raise exception 'Seul le statut peut être modifié' using errcode = '42501';
  end if;

  if new.statut = old.statut then
    return new;
  end if;

  if v_role = 'boulanger'
     and old.statut in ('en_attente', 'preparee')
     and new.statut in ('en_attente', 'preparee') then
    return new;
  end if;

  if v_role = 'vendeur'
     and ((new.statut = 'livree' and old.statut in ('en_attente', 'preparee'))
       or (new.statut = 'annulee' and old.statut = 'en_attente')) then
    return new;
  end if;

  raise exception 'Changement de statut non autorisé (% -> %)', old.statut, new.statut using errcode = '42501';
end;
$$;

create trigger commandes_garde
  before update on public.commandes
  for each row execute function public.garde_commandes();

-- =============================================================
-- Création de commande (chemin unique pour les vendeurs)
-- Prix et TVA copiés depuis le catalogue côté serveur.
-- Idempotent sur p_id pour les renvois hors ligne.
-- =============================================================
create or replace function public.creer_commande(
  p_id uuid,
  p_client_id uuid,
  p_date_livraison date,
  p_lignes jsonb,
  p_notes text default null,
  p_point_de_vente_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := public.mon_role();
  v_pdv uuid;
  v_id uuid := coalesce(p_id, gen_random_uuid());
begin
  if v_role is null or v_role not in ('vendeur', 'admin') then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;

  if v_role = 'vendeur' then
    v_pdv := public.mon_point_de_vente();
    if v_pdv is null then
      raise exception 'Aucun point de vente associé à ce compte' using errcode = 'P0001';
    end if;
  else
    v_pdv := p_point_de_vente_id;
  end if;

  if p_lignes is null or jsonb_typeof(p_lignes) <> 'array' or jsonb_array_length(p_lignes) = 0 then
    raise exception 'La commande est vide' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.commandes where id = v_id) then
    return v_id;
  end if;

  insert into public.commandes (id, client_id, point_de_vente_id, date_livraison, notes, cree_par)
  values (v_id, p_client_id, v_pdv, p_date_livraison, nullif(trim(p_notes), ''), auth.uid());

  insert into public.lignes_commande (commande_id, produit_id, quantite, prix_unitaire_ht, tva)
  select v_id, pr.id, l.quantite, pr.prix_ht, pr.tva
  from jsonb_to_recordset(p_lignes) as l (produit_id uuid, quantite numeric)
  join public.produits pr on pr.id = l.produit_id
  where l.quantite > 0;

  if not found then
    raise exception 'Aucun produit valide dans la commande' using errcode = 'P0001';
  end if;

  return v_id;
end;
$$;

-- =============================================================
-- Vues chiffre d'affaires (RLS de l'appelant appliquée)
-- =============================================================
create view public.vue_ca
with (security_invoker = true)
as
select
  c.id,
  c.date_livraison,
  c.statut,
  c.client_id,
  cl.nom as client_nom,
  cl.type as client_type,
  c.point_de_vente_id,
  pdv.nom as point_de_vente,
  round(sum(lc.quantite * lc.prix_unitaire_ht), 2) as total_ht,
  round(sum(lc.quantite * lc.prix_unitaire_ht * (1 + lc.tva / 100)), 2) as total_ttc
from public.commandes c
join public.clients cl on cl.id = c.client_id
left join public.points_de_vente pdv on pdv.id = c.point_de_vente_id
join public.lignes_commande lc on lc.commande_id = c.id
where c.statut <> 'annulee'
group by c.id, cl.nom, cl.type, pdv.nom;

create view public.vue_ventes_produits
with (security_invoker = true)
as
select
  lc.id,
  c.date_livraison,
  c.statut,
  lc.produit_id,
  p.nom as produit_nom,
  p.unite,
  p.categorie,
  lc.quantite,
  round(lc.quantite * lc.prix_unitaire_ht, 2) as total_ht,
  round(lc.quantite * lc.prix_unitaire_ht * (1 + lc.tva / 100), 2) as total_ttc
from public.lignes_commande lc
join public.commandes c on c.id = lc.commande_id
join public.produits p on p.id = lc.produit_id
where c.statut <> 'annulee';

-- =============================================================
-- Droits d'exécution des fonctions
-- =============================================================
revoke execute on function public.mon_role() from public, anon;
revoke execute on function public.mon_point_de_vente() from public, anon;
revoke execute on function public.creer_commande(uuid, uuid, date, jsonb, text, uuid) from public, anon;
revoke execute on function public.gerer_nouvel_utilisateur() from public, anon, authenticated;
revoke execute on function public.recalculer_total_commande() from public, anon, authenticated;
grant execute on function public.mon_role() to authenticated;
grant execute on function public.mon_point_de_vente() to authenticated;
grant execute on function public.creer_commande(uuid, uuid, date, jsonb, text, uuid) to authenticated;

-- =============================================================
-- Realtime
-- =============================================================
alter publication supabase_realtime add table public.commandes, public.lignes_commande;
