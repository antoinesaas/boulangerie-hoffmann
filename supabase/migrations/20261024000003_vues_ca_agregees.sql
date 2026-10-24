-- =============================================================
-- Vues CA agrégées par jour (dashboard patron)
-- Une ligne par jour × statut × point de vente × segment client :
-- un mois tient en quelques centaines de lignes au lieu de milliers.
-- Les particuliers sont regroupés par type (pas de détail par personne).
-- =============================================================

create view public.vue_ca_jour
with (security_invoker = true)
as
select
  c.date_livraison,
  c.statut,
  c.point_de_vente_id,
  pdv.nom as point_de_vente,
  cl.type as client_type,
  case when cl.type in ('regulier', 'occasionnel') then null else cl.id end as client_id,
  case when cl.type in ('regulier', 'occasionnel') then null else cl.nom end as client_nom,
  count(*)::integer as nb_commandes,
  sum(c.total_ht) as total_ht,
  sum(c.total_ttc) as total_ttc
from public.commandes c
join public.clients cl on cl.id = c.client_id
left join public.points_de_vente pdv on pdv.id = c.point_de_vente_id
where c.statut <> 'annulee'
group by 1, 2, 3, 4, 5, 6, 7;

create view public.vue_ventes_produits_jour
with (security_invoker = true)
as
select
  c.date_livraison,
  c.statut,
  lc.produit_id,
  p.nom as produit_nom,
  p.unite,
  p.categorie,
  sum(lc.quantite) as quantite,
  round(sum(lc.quantite * lc.prix_unitaire_ht), 2) as total_ht,
  round(sum(lc.quantite * lc.prix_unitaire_ht * (1 + lc.tva / 100)), 2) as total_ttc
from public.lignes_commande lc
join public.commandes c on c.id = lc.commande_id
join public.produits p on p.id = lc.produit_id
where c.statut <> 'annulee'
group by 1, 2, 3, 4, 5, 6;

revoke all on public.vue_ca_jour, public.vue_ventes_produits_jour from anon;
