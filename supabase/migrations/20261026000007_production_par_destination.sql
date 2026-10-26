-- Production pointée par destination : le fornil valide « 90 baguettes finies » pour Coffret,
-- « 30 » pour Merveille, etc. destination = id de la boutique, "livraison:<client>" ou "autres".
alter table public.production_faite add column destination text not null default '';
alter table public.production_faite drop constraint production_faite_pkey;
alter table public.production_faite add primary key (date_production, destination, produit_id);
