-- =============================================================
-- Commandes habituelles (chaque semaine), décompte de production,
-- type Tournée créable par les vendeurs.
-- =============================================================

-- Commandes habituelles : une ligne par jour de la semaine (1 = lundi … 7 = dimanche).
-- Les commandes réelles sont générées à l'avance (idempotent) : elles gardent leur
-- statut propre, ce qui permet d'annuler une seule semaine.
create table public.commandes_recurrentes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id),
  point_de_vente_id uuid references public.points_de_vente (id),
  jour_semaine smallint not null check (jour_semaine between 1 and 7),
  lignes jsonb not null,
  notes text,
  date_debut date not null,
  actif boolean not null default true,
  arrete_le timestamptz,
  cree_par uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index commandes_recurrentes_client_idx on public.commandes_recurrentes (client_id);
create index commandes_recurrentes_pdv_idx on public.commandes_recurrentes (point_de_vente_id);
create index commandes_recurrentes_cree_par_idx on public.commandes_recurrentes (cree_par);

alter table public.commandes
  add column recurrente_id uuid references public.commandes_recurrentes (id) on delete set null;
create unique index commandes_recurrente_date_uniq
  on public.commandes (recurrente_id, date_livraison) where recurrente_id is not null;

alter table public.commandes_recurrentes enable row level security;
create policy "recurrentes lecture" on public.commandes_recurrentes
  for select to authenticated
  using (
    (select public.mon_role()) in ('admin', 'boulanger', 'appareil')
    or (
      (select public.mon_role()) = 'vendeur'
      and point_de_vente_id = (select public.mon_point_de_vente())
    )
  );
-- Écritures uniquement via les fonctions ci-dessous.
revoke all on public.commandes_recurrentes from anon;
revoke insert, update, delete on public.commandes_recurrentes from authenticated;

-- Génère les commandes des habitudes actives jusqu'à une date (120 jours max).
create or replace function public.generer_recurrences(p_jusqu_au date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_aujourdhui date := (now() at time zone 'Europe/Paris')::date;
  v_fin date := least(p_jusqu_au, v_aujourdhui + 120);
  v_jour date;
  v_id uuid;
  v_nb integer := 0;
  r record;
begin
  if public.mon_role() is null then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;

  for r in select * from public.commandes_recurrentes where actif loop
    v_jour := greatest(r.date_debut, v_aujourdhui);
    v_jour := v_jour + ((r.jour_semaine - extract(isodow from v_jour)::integer + 7) % 7);
    while v_jour <= v_fin loop
      v_id := null;
      insert into public.commandes (client_id, point_de_vente_id, date_livraison, notes, cree_par, recurrente_id)
      values (r.client_id, r.point_de_vente_id, v_jour, r.notes, r.cree_par, r.id)
      on conflict (recurrente_id, date_livraison) where recurrente_id is not null do nothing
      returning id into v_id;

      if v_id is not null then
        insert into public.lignes_commande (commande_id, produit_id, quantite, prix_unitaire_ht, tva)
        select v_id, pr.id, l.quantite, pr.prix_ht, pr.tva
        from jsonb_to_recordset(r.lignes) as l (produit_id uuid, quantite numeric)
        join public.produits pr on pr.id = l.produit_id
        where l.quantite > 0;
        v_nb := v_nb + 1;
      end if;
      v_jour := v_jour + 7;
    end loop;
  end loop;

  return v_nb;
end;
$$;

-- Arrêt définitif d'une habitude : les prochaines commandes encore en attente sont annulées.
create or replace function public.arreter_recurrence(p_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := public.mon_role();
  v_rec public.commandes_recurrentes;
  v_nb integer;
begin
  select * into v_rec from public.commandes_recurrentes where id = p_id;
  if v_rec.id is null then
    raise exception 'Commande habituelle introuvable' using errcode = 'P0001';
  end if;
  if v_role is null or v_role = 'boulanger'
     or (v_role = 'vendeur' and v_rec.point_de_vente_id is distinct from public.mon_point_de_vente()) then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;

  update public.commandes_recurrentes set actif = false, arrete_le = now() where id = p_id;
  update public.commandes set statut = 'annulee'
  where recurrente_id = p_id
    and statut = 'en_attente'
    and date_livraison >= (now() at time zone 'Europe/Paris')::date;
  get diagnostics v_nb = row_count;
  return v_nb;
end;
$$;

-- creer_commande gagne p_jours_semaine : si renseigné, la commande devient habituelle
-- (une habitude par jour coché) et les prochaines semaines sont générées.
drop function public.creer_commande(uuid, uuid, date, jsonb, text, uuid);
create function public.creer_commande(
  p_id uuid,
  p_client_id uuid,
  p_date_livraison date,
  p_lignes jsonb,
  p_notes text default null,
  p_point_de_vente_id uuid default null,
  p_jours_semaine smallint[] default null
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
  v_lignes jsonb;
  v_jour smallint;
  v_premier boolean := true;
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

  -- Commande habituelle
  if p_jours_semaine is not null and cardinality(p_jours_semaine) > 0 then
    if exists (select 1 from public.commandes_recurrentes where id = v_id) then
      return v_id;
    end if;

    select jsonb_agg(jsonb_build_object('produit_id', pr.id, 'quantite', l.quantite))
    into v_lignes
    from jsonb_to_recordset(p_lignes) as l (produit_id uuid, quantite numeric)
    join public.produits pr on pr.id = l.produit_id
    where l.quantite > 0;
    if v_lignes is null then
      raise exception 'Aucun produit valide dans la commande' using errcode = 'P0001';
    end if;

    for v_jour in select distinct j from unnest(p_jours_semaine) as j where j between 1 and 7 order by 1 loop
      insert into public.commandes_recurrentes
        (id, client_id, point_de_vente_id, jour_semaine, lignes, notes, date_debut, cree_par)
      values (
        case when v_premier then v_id else gen_random_uuid() end,
        p_client_id, v_pdv, v_jour, v_lignes, nullif(trim(p_notes), ''), p_date_livraison, auth.uid()
      );
      v_premier := false;
    end loop;

    perform public.generer_recurrences(greatest(p_date_livraison, (now() at time zone 'Europe/Paris')::date) + 14);
    return v_id;
  end if;

  -- Commande ponctuelle
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

-- Décompte de production : quantité déjà faite par produit et par jour
create table public.production_faite (
  date_production date not null,
  produit_id uuid not null references public.produits (id) on delete cascade,
  quantite numeric(10, 3) not null default 0 check (quantite >= 0),
  maj_le timestamptz not null default now(),
  primary key (date_production, produit_id)
);

create index production_faite_produit_idx on public.production_faite (produit_id);
alter table public.production_faite enable row level security;
create policy "production lecture" on public.production_faite
  for select to authenticated
  using ((select public.mon_role()) is not null);
create policy "production insert" on public.production_faite
  for insert to authenticated
  with check ((select public.mon_role()) in ('admin', 'boulanger', 'appareil'));
create policy "production update" on public.production_faite
  for update to authenticated
  using ((select public.mon_role()) in ('admin', 'boulanger', 'appareil'))
  with check ((select public.mon_role()) in ('admin', 'boulanger', 'appareil'));
create policy "production delete" on public.production_faite
  for delete to authenticated
  using ((select public.mon_role()) in ('admin', 'boulanger', 'appareil'));
revoke all on public.production_faite from anon;

-- Les vendeurs (et appareils) peuvent aussi créer un client « Tournée »
drop policy "clients insert" on public.clients;
create policy "clients insert" on public.clients
  for insert to authenticated
  with check (
    (select public.mon_role()) = 'admin'
    or ((select public.mon_role()) in ('vendeur', 'appareil') and type in ('regulier', 'occasionnel', 'tournee'))
  );

-- Droits d'exécution
revoke execute on function public.generer_recurrences(date) from public, anon;
revoke execute on function public.arreter_recurrence(uuid) from public, anon;
revoke execute on function public.creer_commande(uuid, uuid, date, jsonb, text, uuid, smallint[]) from public, anon;
grant execute on function public.generer_recurrences(date) to authenticated;
grant execute on function public.arreter_recurrence(uuid) to authenticated;
grant execute on function public.creer_commande(uuid, uuid, date, jsonb, text, uuid, smallint[]) to authenticated;

alter publication supabase_realtime add table public.production_faite, public.commandes_recurrentes;
