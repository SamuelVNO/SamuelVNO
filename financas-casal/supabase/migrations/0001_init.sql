-- Finanças do Casal — estrutura de sincronização
-- Rode este arquivo no SQL Editor do Supabase (Dashboard > SQL > New query).

create extension if not exists "pgcrypto";

-- Um "lar" guarda todos os dados financeiros como um documento JSON.
create table if not exists public.households (
  id           uuid primary key default gen_random_uuid(),
  name         text not null default 'Nossas Finanças',
  invite_code  text not null unique,
  data         jsonb not null default '{}'::jsonb,
  updated_at   timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

-- Quem pode enxergar cada lar.
create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  display_name text,
  joined_at    timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index if not exists household_members_user_idx
  on public.household_members(user_id);

alter table public.households        enable row level security;
alter table public.household_members enable row level security;

-- Evita recursão de política: função com privilégio elevado.
create or replace function public.is_household_member(h uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = h and m.user_id = auth.uid()
  );
$$;

drop policy if exists households_select on public.households;
create policy households_select on public.households
  for select using (public.is_household_member(id));

drop policy if exists households_update on public.households;
create policy households_update on public.households
  for update using (public.is_household_member(id))
  with check (public.is_household_member(id));

drop policy if exists households_insert on public.households;
create policy households_insert on public.households
  for insert with check (auth.uid() is not null);

drop policy if exists members_select on public.household_members;
create policy members_select on public.household_members
  for select using (public.is_household_member(household_id));

drop policy if exists members_insert on public.household_members;
create policy members_insert on public.household_members
  for insert with check (user_id = auth.uid());

drop policy if exists members_delete on public.household_members;
create policy members_delete on public.household_members
  for delete using (user_id = auth.uid());

-- Cria um lar novo e já adiciona quem chamou como membro.
create or replace function public.create_household(p_name text default 'Nossas Finanças')
returns public.households
language plpgsql
security definer
set search_path = public
as $$
declare
  h public.households;
  code text;
begin
  if auth.uid() is null then
    raise exception 'É preciso estar autenticado.';
  end if;

  loop
    code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (select 1 from public.households where invite_code = code);
  end loop;

  insert into public.households (name, invite_code)
  values (coalesce(nullif(p_name, ''), 'Nossas Finanças'), code)
  returning * into h;

  insert into public.household_members (household_id, user_id)
  values (h.id, auth.uid())
  on conflict do nothing;

  return h;
end;
$$;

-- Entra em um lar existente usando o código de convite.
create or replace function public.join_household(p_code text)
returns public.households
language plpgsql
security definer
set search_path = public
as $$
declare
  h public.households;
begin
  if auth.uid() is null then
    raise exception 'É preciso estar autenticado.';
  end if;

  select * into h from public.households
  where invite_code = upper(trim(p_code));

  if h.id is null then
    raise exception 'Código de convite inválido.';
  end if;

  insert into public.household_members (household_id, user_id)
  values (h.id, auth.uid())
  on conflict do nothing;

  return h;
end;
$$;

grant execute on function public.create_household(text) to authenticated;
grant execute on function public.join_household(text)  to authenticated;
grant execute on function public.is_household_member(uuid) to authenticated;

-- Atualiza updated_at automaticamente.
create or replace function public.touch_household()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists households_touch on public.households;
create trigger households_touch before update on public.households
  for each row execute function public.touch_household();

-- Sincronização em tempo real entre celular e computador.
do $$
begin
  alter publication supabase_realtime add table public.households;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$$;
