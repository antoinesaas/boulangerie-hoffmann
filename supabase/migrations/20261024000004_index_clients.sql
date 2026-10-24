-- Index de la clé étrangère clients.cree_par (conseil "Unindexed foreign keys")
create index if not exists clients_cree_par_idx on public.clients (cree_par);
