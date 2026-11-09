-- BiixiPay Cloud database for the NS Cellphone Store POS (web/ns/).
-- Run once in Supabase: SQL Editor -> New query -> paste all of this -> Run.
-- Safe to run again: it only creates what is missing and replaces the functions and rules.
--
-- Tables
--   pos_stores   one row per store
--   pos_members  who can use a store (owner or staff), linked to Supabase sign-in accounts
--   pos_records  every product, phone, sale, repair, customer... as one JSON row each
-- Only signed-in members of a store can read or change that store's data.

create table if not exists public.pos_stores (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.pos_members (
  store_id   uuid not null references public.pos_stores(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'staff' check (role in ('owner','staff')),
  created_at timestamptz not null default now(),
  primary key (store_id, user_id)
);
create index if not exists pos_members_user_idx on public.pos_members(user_id);

create table if not exists public.pos_records (
  store_id   uuid not null references public.pos_stores(id) on delete cascade,
  kind       text not null,
  id         text not null,
  data       jsonb not null default '{}'::jsonb,
  deleted    boolean not null default false,
  updated_at timestamptz not null default clock_timestamp(),
  primary key (store_id, kind, id)
);
-- The app downloads "everything changed since my last sync", ordered by updated_at.
create index if not exists pos_records_sync_idx on public.pos_records(store_id, updated_at);

-- The server stamps the time on every save, so devices with wrong clocks still sync correctly.
create or replace function public.pos_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end $$;
drop trigger if exists pos_records_touch on public.pos_records;
create trigger pos_records_touch before insert or update on public.pos_records
  for each row execute function public.pos_touch();

-- Membership checks (security definer so the rules below don't loop on themselves).
create or replace function public.pos_is_member(p_store uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from pos_members where store_id = p_store and user_id = auth.uid());
$$;
create or replace function public.pos_is_owner(p_store uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from pos_members where store_id = p_store and user_id = auth.uid() and role = 'owner');
$$;

alter table public.pos_stores  enable row level security;
alter table public.pos_members enable row level security;
alter table public.pos_records enable row level security;

drop policy if exists "members read store"   on public.pos_stores;
drop policy if exists "owners rename store"  on public.pos_stores;
create policy "members read store"  on public.pos_stores for select to authenticated using (public.pos_is_member(id));
create policy "owners rename store" on public.pos_stores for update to authenticated using (public.pos_is_owner(id)) with check (public.pos_is_owner(id));

drop policy if exists "members see team"     on public.pos_members;
drop policy if exists "owners remove staff"  on public.pos_members;
create policy "members see team"    on public.pos_members for select to authenticated using (user_id = auth.uid() or public.pos_is_member(store_id));
create policy "owners remove staff" on public.pos_members for delete to authenticated using (public.pos_is_owner(store_id) and user_id <> auth.uid());

drop policy if exists "members read records"   on public.pos_records;
drop policy if exists "members add records"    on public.pos_records;
drop policy if exists "members change records" on public.pos_records;
create policy "members read records"   on public.pos_records for select to authenticated using (public.pos_is_member(store_id));
create policy "members add records"    on public.pos_records for insert to authenticated with check (public.pos_is_member(store_id));
create policy "members change records" on public.pos_records for update to authenticated using (public.pos_is_member(store_id)) with check (public.pos_is_member(store_id));
-- No delete rule: the app marks rows deleted instead, so other devices learn about the delete.

-- "Create & upload this device's data": makes a store and the signed-in user its owner.
create or replace function public.pos_create_store(p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  insert into pos_stores(name, created_by) values (coalesce(nullif(trim(p_name), ''), 'My store'), auth.uid()) returning id into sid;
  insert into pos_members(store_id, user_id, role) values (sid, auth.uid(), 'owner');
  return sid;
end $$;

-- "Add staff by email": the owner adds someone who has already created an account.
create or replace function public.pos_add_member(p_store uuid, p_email text) returns void
language plpgsql security definer set search_path = public, auth as $$
declare uid uuid;
begin
  if not public.pos_is_owner(p_store) then raise exception 'Only the store owner can add staff'; end if;
  select id into uid from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if uid is null then raise exception 'No account with that email yet. Ask them to tap "Create account" in the app first.'; end if;
  insert into pos_members(store_id, user_id, role) values (p_store, uid, 'staff') on conflict do nothing;
end $$;

revoke all on function public.pos_create_store(text)      from public, anon;
revoke all on function public.pos_add_member(uuid, text)  from public, anon;
grant execute on function public.pos_create_store(text)     to authenticated;
grant execute on function public.pos_add_member(uuid, text) to authenticated;
grant execute on function public.pos_is_member(uuid) to authenticated;
grant execute on function public.pos_is_owner(uuid)  to authenticated;

grant select, update         on public.pos_stores  to authenticated;
grant select, delete         on public.pos_members to authenticated;
grant select, insert, update on public.pos_records to authenticated;
