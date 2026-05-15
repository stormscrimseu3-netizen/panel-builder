-- Roles
create type public.app_role as enum ('admin', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

create policy "Users can read own roles" on public.user_roles
  for select using (auth.uid() = user_id);
create policy "Admins can read all roles" on public.user_roles
  for select using (public.has_role(auth.uid(), 'admin'));
create policy "Admins can manage roles" on public.user_roles
  for all using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- App settings (singleton)
create table public.app_settings (
  id boolean primary key default true check (id = true),
  allow_public_signup boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (id) values (true) on conflict do nothing;

alter table public.app_settings enable row level security;

create policy "Anyone can read settings" on public.app_settings
  for select using (true);
create policy "Admins can update settings" on public.app_settings
  for update using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Update handle_new_user to grant admin to first user
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
  candidate_username text;
  suffix integer := 0;
  is_first boolean;
begin
  base_username := lower(regexp_replace(coalesce(
    nullif(new.raw_user_meta_data->>'username', ''),
    split_part(new.email, '@', 1),
    'user'), '[^a-z0-9_]+', '_', 'g'));
  base_username := trim(both '_' from base_username);
  if base_username = '' then base_username := 'user'; end if;

  candidate_username := base_username;
  while exists (select 1 from public.profiles where username = candidate_username) loop
    suffix := suffix + 1;
    candidate_username := base_username || '_' || suffix::text;
  end loop;

  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    candidate_username,
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), candidate_username)
  )
  on conflict (id) do nothing;

  select not exists (select 1 from public.user_roles where role = 'admin') into is_first;
  insert into public.user_roles (user_id, role)
  values (new.id, case when is_first then 'admin'::public.app_role else 'user'::public.app_role end)
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: grant admin to oldest existing user if none exist
insert into public.user_roles (user_id, role)
select id, 'admin'::public.app_role from auth.users
where not exists (select 1 from public.user_roles where role = 'admin')
order by created_at asc limit 1
on conflict do nothing;

-- Grant 'user' role to everyone else
insert into public.user_roles (user_id, role)
select u.id, 'user'::public.app_role from auth.users u
where not exists (select 1 from public.user_roles r where r.user_id = u.id)
on conflict do nothing;

-- Allow admins to view all profiles (for username lookups)
create policy "Admins can view all profiles" on public.profiles
  for select using (public.has_role(auth.uid(), 'admin'));

-- Admins can create servers for any user
create policy "Admins can manage all servers" on public.servers
  for all using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));