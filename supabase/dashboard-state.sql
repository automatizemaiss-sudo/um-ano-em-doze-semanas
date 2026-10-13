-- Executar no SQL Editor de Prototipos-Imobiliarias.
-- Tabela usada pelo dashboard atual; preserva tabelas existentes do projeto.
create table if not exists public.dashboard_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  state jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.dashboard_states enable row level security;
drop policy if exists own_data on public.dashboard_states;
create policy own_data on public.dashboard_states
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
grant select, insert, update, delete on public.dashboard_states to authenticated;
notify pgrst, 'reload schema';
