# Boulangerie Hoffmann — gestion des commandes

Application web qui remplace le papier et les messageries pour les commandes de la boulangerie :
3 points de vente (Coffret, Merveille, Lermberg), clients professionnels en tournée, particuliers.

- **Vendeur** (mobile) : saisie rapide d'une commande, ajout d'un client à la volée, fonctionne hors ligne.
- **Fornil** (tablette) : commandes à produire en temps réel, par jour et par point de vente, mode nuit, impression.
- **Patron** : toutes les commandes, catalogue et prix, clients, comptes, chiffre d'affaires en temps réel.

**Production : https://boulangerie-hoffmann.vercel.app** (l'ancienne adresse boulangerie-guillaume.vercel.app redirige ici)

Stack : Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · shadcn/ui · Recharts · Supabase (Postgres, Auth, Realtime) · Vercel.

## Démarrage local

```bash
npm install
cp .env.example .env.local   # puis remplir les clés
npm run dev
```

Ouvrir http://localhost:3000.

## Mise en place de Supabase

Projet `boulangerie-hoffmann` (réf. `xhgzmidxfyzxvozjvhku`) (https://supabase.com/dashboard/project/xhgzmidxfyzxvozjvhku)

### 1. Base de données

Exécuter dans l'ordre, dans **SQL Editor** (ou `supabase db push` avec la CLI liée au projet) :

1. `supabase/migrations/20261024000001_schema.sql` — tables, triggers, fonction `creer_commande`, vues, Realtime
2. `supabase/migrations/20261024000002_rls.sql` — Row Level Security
3. `supabase/migrations/20261024000003_vues_ca_agregees.sql` — vues CA agrégées
4. `supabase/migrations/20261024000004_index_clients.sql` — index de performance
5. `supabase/migrations/20261024000005_appareils.sql` — appareils activés et codes d'activation
6. `supabase/migrations/20261026000006_habituelles_production.sql` — commandes habituelles, décompte de production, type Tournée
7. `supabase/migrations/20261026000007_production_par_destination.sql` — production validée par magasin
5. `supabase/seed.sql` — points de vente, clients pros, produits par défaut (relançable sans doublons)

Les versions appliquées sont enregistrées dans `supabase_migrations.schema_migrations` (compatible `supabase db push`).

### 2. Authentification

- **Authentication → Sign In / Providers → Email** : laisser activé, **désactiver « Allow new users to sign up »**
  (les comptes sont créés par le patron depuis `/admin/utilisateurs`).
- Les rôles ne sont jamais lus depuis des données modifiables par l'utilisateur : un compte créé hors de l'app n'a aucun accès.

### 3. Clés (Project Settings → API Keys)

| Variable | Où la trouver | Exposée au navigateur |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xhgzmidxfyzxvozjvhku.supabase.co` | oui |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | clé `sb_publishable_…` (ou l'ancienne clé `anon` dans `NEXT_PUBLIC_SUPABASE_ANON_KEY`) | oui |
| `SUPABASE_SECRET_KEY` | clé `sb_secret_…` (ou `service_role`) | **non — serveur uniquement** |

La clé secrète ne sert qu'à la gestion des comptes (création, mot de passe, désactivation). Sans elle, tout le reste fonctionne.

### 4. Premier compte patron

```bash
npm run creer-admin -- patron@exemple.fr "un-mot-de-passe-solide" "Patron"
```

Ensuite, se connecter et créer les comptes vendeurs (rattachés à un point de vente) et boulangers dans **Utilisateurs**,
ou en ligne de commande :

```bash
npm run creer-compte -- vendeuse@exemple.fr "mot-de-passe" "Julie" vendeur Coffret
npm run creer-compte -- fornil@exemple.fr "mot-de-passe" "Fornil" boulanger
```

## Déploiement Vercel

Projet Vercel `boulangerie-hoffmann` (équipe flynoxcontact-8291's projects), relié au dépôt GitHub, région des fonctions `cdg1` (Paris).

1. Importer le dépôt GitHub `antoinesaas/boulangerie-hoffmann` dans Vercel (framework détecté : Next.js) — déjà fait.
2. **Settings → Environment Variables** (Production + Preview) : `NEXT_PUBLIC_SUPABASE_URL` et
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (déjà en place), `SUPABASE_SECRET_KEY` (type *Sensitive*, à ajouter).
3. Déployer. Chaque push sur `main` redéploie automatiquement.
4. Dans Supabase → **Authentication → URL Configuration**, mettre l'URL Vercel dans *Site URL*.

Node.js ≥ 20.9 (Vercel par défaut).

## Utilisation au quotidien (sans mot de passe)

- **Seul le patron a un compte** (email + mot de passe), via « Connexion patron ». À la toute première
  ouverture, s'il n'existe aucun patron, la page de connexion propose de créer ce compte.
- **Téléphones des boutiques et tablette du fornil** : on installe l'app (icône « Hoffmann » sur l'écran
  d'accueil), puis on l'**active une seule fois** avec un code à 6 chiffres que le patron génère dans
  **Appareils** (valable 15 min, usage unique). Ensuite l'appareil ouvre un écran de choix :
  **Vendeur → Coffret / Merveille / Lermberg** ou **Fornil**. Plus jamais de mot de passe.
- Un appareil perdu ou remplacé se **désactive** dans **Appareils** (effet immédiat).
- Quelqu'un qui tombe sur l'adresse sans appareil activé ne voit que l'écran d'activation.

Sur iPhone / iPad, installer d'abord l'app (Safari → Partager → Sur l'écran d'accueil), puis l'activer
**depuis l'icône** : l'app installée a sa propre mémoire.

## Commandes habituelles

En saisissant une commande, « Toutes les semaines » la répète chaque semaine aux jours cochés (activé d'office
pour un client régulier ou une boutique). Les commandes des semaines à venir sont créées automatiquement.
Dans « Mes commandes » : **Annuler cette semaine** (une seule date) ou **Arrêter pour toujours**.

## Fornil

- **À produire** : en haut, le bandeau du total restant tous magasins confondus (ex. 141 Baguette tradition), puis une
  carte par magasin (et par client livré) avec son total, commandes et habituelle confondues. « Fini » valide une ligne
  (ex. 91 baguettes pour Coffret), un appui sur le chiffre indique une partie faite. Quand tout un magasin est fini,
  ses commandes passent « préparée ». Une commande arrivée après ne fait réapparaître que la différence.
- **Envois** : une carte par boutique (habituelle + commandes des clients de la boutique, additionnées) et une carte par
  client livré (tournée, marché, pro). Un seul bouton « Prêt » valide tout l'envoi.
- **Habituelles** : ce que chaque boutique / client reçoit chaque jour de la semaine.

## Tests

```bash
npm test          # décompte et envois du fornil (scénarios réalistes)
npm run test:sql  # 76 tests RLS, triggers, habitudes, production (Postgres embarqué)
```

## Fonctionnement

### Rôles et accès

| Rôle | Pages | Droits (RLS) |
|---|---|---|
| `vendeur` | `/vendeur/commande`, `/vendeur/mes-commandes` | crée des commandes pour **son** point de vente, voit uniquement les commandes de son point de vente, ajoute des particuliers, marque « livrée » ou annule une commande en attente |
| `boulanger` | `/fornil` | lit tout, passe une commande en « préparée » (et retour en attente) |
| `admin` | tout | lit et modifie tout |

Le routage par rôle est fait dans `proxy.ts` (Next.js 16 a renommé `middleware` en `proxy`) ; chaque page et
chaque action serveur revérifie le rôle, et la base applique la RLS quoi qu'il arrive.

### Prix figés

Une commande passe toujours par la fonction SQL `creer_commande()` : le prix HT et la TVA de chaque produit sont
copiés **côté serveur** dans `lignes_commande`. Modifier le catalogue n'affecte jamais l'historique, et un navigateur
ne peut pas imposer un prix.

### Hors ligne (vendeurs)

La commande est d'abord écrite dans une file `localStorage`, puis envoyée. Sans réseau elle reste sur le téléphone
et repart automatiquement (retour du réseau, retour sur l'onglet, toutes les 20 s). L'identifiant de commande est
généré sur le téléphone : un renvoi ne crée jamais de doublon. Un service worker (`public/sw.js`) garde les pages
vendeur en cache pour pouvoir rouvrir l'écran sans réseau.

### Fornil

Onglets Aujourd'hui / Demain / J+2 / J+3, sections par point de vente puis « Livraisons » (tournées, marchés, pros),
récapitulatif « À produire » par produit, nouvelles commandes en surbrillance avec son optionnel, mode nuit,
impression (bouton « Voir tout en print »).

### Chiffre d'affaires

Par date de livraison. Par défaut **réalisé** = commandes préparées + livrées ; l'interrupteur « Inclure les
commandes en attente » donne le prévisionnel. Le tableau « par type de livraison » détaille les points de vente,
chaque tournée et chaque pro, puis Marché, Particuliers réguliers, Particuliers occasionnels. Export CSV (Excel FR).

Les clients de type `point_de_vente` (Coffret, Merveille, Lermberg) servent aux commandes de vitrine de chaque boutique.

## Structure

```
app/            pages (login, vendeur, fornil, admin/*), actions serveur
components/     ui (shadcn), commandes, fornil, ca, produits, clients, utilisateurs, layout
lib/supabase/   clients navigateur / serveur / admin, rafraîchissement de session pour le proxy
lib/hooks/      useRealtime, useCommandes, useCA, useFileAttente
lib/offline/    file d'attente hors ligne
lib/utils/      formatPrix, formatDate, calcTTC, dates (Europe/Paris)
types/          types TypeScript
supabase/       migrations SQL + seed
proxy.ts        routage par rôle
```
