-- =============================================================
-- Appareils activés (téléphones des boutiques, tablette du fornil)
-- Un appareil est activé une fois par le patron avec un code à usage unique.
-- Il peut ensuite passer librement en mode Vendeur (boutique au choix) ou Fornil,
-- sans mot de passe. Seul le patron a un compte classique.
-- =============================================================

alter table public.profils drop constraint profils_role_check;
alter table public.profils
  add constraint profils_role_check check (role in ('vendeur', 'boulanger', 'admin', 'appareil'));

-- Le rôle "appareil" peut aussi être posé à la création du compte (app_metadata)
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
    case when v_role in ('vendeur', 'boulanger', 'admin', 'appareil') then v_role end,
    case when v_pdv ~ '^[0-9a-f-]{36}$' then v_pdv::uuid end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Codes d'activation (gérés uniquement côté serveur avec la clé secrète)
create table public.codes_activation (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null,
  nom_appareil text not null,
  expire_le timestamptz not null,
  utilise_le timestamptz,
  essais integer not null default 0,
  cree_par uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index codes_activation_cree_par_idx on public.codes_activation (cree_par);
alter table public.codes_activation enable row level security;
-- Aucune policy : ni le navigateur ni les comptes connectés n'y accèdent directement.
revoke all on public.codes_activation from anon, authenticated;

-- Commandes : un appareil voit et met à jour toutes les commandes
drop policy "commandes lecture" on public.commandes;
create policy "commandes lecture" on public.commandes
  for select to authenticated
  using (
    (select public.mon_role()) in ('admin', 'boulanger', 'appareil')
    or (
      (select public.mon_role()) = 'vendeur'
      and point_de_vente_id = (select public.mon_point_de_vente())
    )
  );

drop policy "commandes update" on public.commandes;
create policy "commandes update" on public.commandes
  for update to authenticated
  using (
    (select public.mon_role()) in ('admin', 'boulanger', 'appareil')
    or (
      (select public.mon_role()) = 'vendeur'
      and point_de_vente_id = (select public.mon_point_de_vente())
    )
  )
  with check (
    (select public.mon_role()) in ('admin', 'boulanger', 'appareil')
    or (
      (select public.mon_role()) = 'vendeur'
      and point_de_vente_id = (select public.mon_point_de_vente())
    )
  );

-- Clients : un appareil peut ajouter des particuliers, comme un vendeur
drop policy "clients insert" on public.clients;
create policy "clients insert" on public.clients
  for insert to authenticated
  with check (
    (select public.mon_role()) = 'admin'
    or ((select public.mon_role()) in ('vendeur', 'appareil') and type in ('regulier', 'occasionnel'))
  );

-- Transitions de statut : un appareil cumule les droits du fornil et du vendeur
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

  if v_role in ('boulanger', 'appareil')
     and old.statut in ('en_attente', 'preparee')
     and new.statut in ('en_attente', 'preparee') then
    return new;
  end if;

  if v_role in ('vendeur', 'appareil')
     and ((new.statut = 'livree' and old.statut in ('en_attente', 'preparee'))
       or (new.statut = 'annulee' and old.statut = 'en_attente')) then
    return new;
  end if;

  raise exception 'Changement de statut non autorisé (% -> %)', old.statut, new.statut using errcode = '42501';
end;
$$;

-- Création de commande : un appareil indique la boutique choisie (obligatoire)
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
  if v_role is null or v_role not in ('vendeur', 'admin', 'appareil') then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;

  if v_role = 'vendeur' then
    v_pdv := public.mon_point_de_vente();
    if v_pdv is null then
      raise exception 'Aucun point de vente associé à ce compte' using errcode = 'P0001';
    end if;
  else
    v_pdv := p_point_de_vente_id;
    if v_role = 'appareil'
       and (v_pdv is null or not exists (select 1 from public.points_de_vente where id = v_pdv and actif)) then
      raise exception 'Choisissez une boutique' using errcode = 'P0001';
    end if;
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
