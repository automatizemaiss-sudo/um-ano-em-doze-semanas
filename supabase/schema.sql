-- Execute no SQL Editor do Supabase. A aplicação usa dashboard_states;
-- entidades normalizadas abaixo oferecem a base para APIs e integrações futuras.
create extension if not exists pgcrypto;
create table if not exists public.dashboard_states (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null unique references auth.users(id) on delete cascade,
 state jsonb not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.periods (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 name text not null, starts_at timestamptz not null, ends_at timestamptz not null,
 status text not null default 'future' check(status in ('future','active','closed')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(id,user_id),check(ends_at>starts_at)
);
create unique index if not exists one_active_period_per_user on public.periods(user_id) where status='active';
create table if not exists public.execution_areas (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 name text not null,weight numeric not null default 1 check(weight>=0),sort_order int not null default 0,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(id,user_id)
);
create table if not exists public.metrics (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 area_id uuid not null,name text not null,unit text not null,kind text not null check(kind in ('lead','lag')),
 direction text not null default 'increase',weight numeric not null default 1 check(weight>=0),
 default_target numeric check(default_target>=0),frequency jsonb,active boolean not null default true,sort_order int not null default 0,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(id,user_id),
 foreign key(area_id,user_id) references public.execution_areas(id,user_id) on delete cascade
);
create table if not exists public.period_weeks (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 period_id uuid not null,week_number int not null check(week_number between 1 and 12),
 targets_snapshot jsonb not null,weights_snapshot jsonb not null,
 reviewed boolean not null default false,review_note text,closed_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(id,user_id),unique(period_id,week_number),
 foreign key(period_id,user_id) references public.periods(id,user_id) on delete cascade
);
create table if not exists public.daily_entries (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 week_id uuid not null,entry_date date not null,values jsonb not null default '{}',
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(id,user_id),unique(week_id,entry_date),
 foreign key(week_id,user_id) references public.period_weeks(id,user_id) on delete cascade
);
create table if not exists public.training_sessions (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 entry_id uuid not null,training_type text not null,quality int not null check(quality between 1 and 5),
 duration_minutes int check(duration_minutes>=0),note text,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(entry_id,user_id) references public.daily_entries(id,user_id) on delete cascade
);
create table if not exists public.period_goals (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 period_id uuid not null,name text not null,unit text,target numeric,initial_value numeric not null default 0,
 projection_type text check(projection_type in ('flow','stock','none')),description text,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(id,user_id),
 foreign key(period_id,user_id) references public.periods(id,user_id) on delete cascade
);
create table if not exists public.goal_progress (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 goal_id uuid not null,value numeric not null,recorded_at timestamptz not null default now(),note text,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(goal_id,user_id) references public.period_goals(id,user_id) on delete cascade
);
create table if not exists public.life_areas (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 name text not null,vision text not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(id,user_id)
);
create table if not exists public.life_area_assessments (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 period_id uuid not null,life_area_id uuid not null,initial_rating numeric check(initial_rating between 0 and 10),
 final_rating numeric check(final_rating between 0 and 10),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(period_id,life_area_id),
 foreign key(period_id,user_id) references public.periods(id,user_id) on delete cascade,
 foreign key(life_area_id,user_id) references public.life_areas(id,user_id) on delete cascade
);
create table if not exists public.period_strategies (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 period_id uuid not null,body text not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(period_id,user_id) references public.periods(id,user_id) on delete cascade
);
-- Composição das foreign keys impede referência cruzada a entidades de outro usuário.
do $$ declare t text; begin
 foreach t in array array['dashboard_states','periods','execution_areas','metrics','period_weeks','daily_entries','training_sessions','period_goals','goal_progress','life_areas','life_area_assessments','period_strategies'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('drop policy if exists own_data on public.%I',t);
 execute format('create policy own_data on public.%I for all to authenticated using (auth.uid()=user_id) with check(auth.uid()=user_id)',t);
 end loop;
end $$;
create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path=public as $$ begin new.updated_at=now();return new;end $$;
do $$ declare t text; begin
 foreach t in array array['dashboard_states','periods','execution_areas','metrics','period_weeks','daily_entries','training_sessions','period_goals','goal_progress','life_areas','life_area_assessments','period_strategies'] loop
 execute format('drop trigger if exists touch_updated_at on public.%I',t);
 execute format('create trigger touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()',t);
 end loop;
end $$;
create or replace function public.preserve_initial_rating() returns trigger language plpgsql set search_path=public as $$ begin
 if old.initial_rating is not null and new.initial_rating is distinct from old.initial_rating then raise exception 'A nota inicial já foi registrada e não pode ser sobrescrita';end if;return new;
end $$;
drop trigger if exists preserve_initial_rating on public.life_area_assessments;
create trigger preserve_initial_rating before update on public.life_area_assessments for each row execute function public.preserve_initial_rating();
