
-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "Profiles are viewable by owner" on public.profiles for select using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, display_name)
  values (new.id, split_part(new.email, '@', 1), coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Servers (bot hosting instances)
create type public.server_runtime as enum ('nodejs', 'python', 'java', 'docker');
create type public.server_status as enum ('offline', 'starting', 'online', 'stopping', 'crashed');

create table public.servers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  runtime public.server_runtime not null default 'nodejs',
  status public.server_status not null default 'offline',
  memory_mb integer not null default 512,
  cpu_percent integer not null default 50,
  disk_mb integer not null default 1024,
  start_command text not null default 'node index.js',
  node_id text default 'node-01',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.servers enable row level security;
create policy "Servers viewable by owner" on public.servers for select using (auth.uid() = user_id);
create policy "Users can create servers" on public.servers for insert with check (auth.uid() = user_id);
create policy "Users can update own servers" on public.servers for update using (auth.uid() = user_id);
create policy "Users can delete own servers" on public.servers for delete using (auth.uid() = user_id);

-- Files
create table public.server_files (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references public.servers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  path text not null,
  content text not null default '',
  size_bytes integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(server_id, path)
);
alter table public.server_files enable row level security;
create policy "Files viewable by owner" on public.server_files for select using (auth.uid() = user_id);
create policy "Users can create files" on public.server_files for insert with check (auth.uid() = user_id);
create policy "Users can update own files" on public.server_files for update using (auth.uid() = user_id);
create policy "Users can delete own files" on public.server_files for delete using (auth.uid() = user_id);

-- Console logs
create table public.console_logs (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references public.servers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  level text not null default 'info',
  message text not null,
  created_at timestamptz not null default now()
);
alter table public.console_logs enable row level security;
create policy "Logs viewable by owner" on public.console_logs for select using (auth.uid() = user_id);
create policy "Users can insert own logs" on public.console_logs for insert with check (auth.uid() = user_id);
create policy "Users can delete own logs" on public.console_logs for delete using (auth.uid() = user_id);

create index on public.servers(user_id);
create index on public.server_files(server_id);
create index on public.console_logs(server_id, created_at desc);
