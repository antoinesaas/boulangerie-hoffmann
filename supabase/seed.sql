-- =============================================================
-- Données initiales (idempotent : relançable sans doublons)
-- =============================================================

insert into public.points_de_vente (nom, ordre)
select v.nom, v.ordre
from (values ('Coffret', 1), ('Merveille', 2), ('Lermberg', 3)) as v (nom, ordre)
where not exists (select 1 from public.points_de_vente p where p.nom = v.nom);

-- Clients professionnels / récurrents.
-- Les clients de type point_de_vente servent aux commandes de vitrine de chaque boutique.
insert into public.clients (nom, type, note)
select v.nom, v.type, v.note
from (
  values
    ('Coffret', 'point_de_vente', 'Commande de vitrine du point de vente'),
    ('Merveille', 'point_de_vente', 'Commande de vitrine du point de vente'),
    ('Lermberg', 'point_de_vente', 'Point de vente, aussi livré par la tournée'),
    ('Armée', 'tournee', 'Livraison tournée'),
    ('Relais de châteaux', 'tournee', 'Livraison tournée')
) as v (nom, type, note)
where not exists (select 1 from public.clients c where c.nom = v.nom and c.type = v.type);

insert into public.produits (nom, unite, prix_ht, tva, categorie, ordre)
select v.nom, v.unite, v.prix_ht, v.tva, v.categorie, v.ordre
from (
  values
    ('Baguette tradition', 'pièce', 1.20, 5.5, 'pain', 1),
    ('Pain de campagne', 'pièce', 3.50, 5.5, 'pain', 2),
    ('Croissant', 'pièce', 1.40, 10, 'viennoiserie', 3),
    ('Pain au chocolat', 'pièce', 1.40, 10, 'viennoiserie', 4),
    ('Chausson aux pommes', 'pièce', 1.60, 10, 'viennoiserie', 5),
    ('Brioche', 'pièce', 4.50, 10, 'viennoiserie', 6)
) as v (nom, unite, prix_ht, tva, categorie, ordre)
where not exists (select 1 from public.produits p where p.nom = v.nom);
