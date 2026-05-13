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
begin
  base_username := lower(regexp_replace(coalesce(split_part(new.email, '@', 1), 'user'), '[^a-z0-9_]+', '_', 'g'));
  base_username := trim(both '_' from base_username);

  if base_username = '' then
    base_username := 'user';
  end if;

  candidate_username := base_username;
  while exists (select 1 from public.profiles where username = candidate_username) loop
    suffix := suffix + 1;
    candidate_username := base_username || '_' || suffix::text;
  end loop;

  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    candidate_username,
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), split_part(new.email, '@', 1), 'User')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'on_auth_user_created'
      and tgrelid = 'auth.users'::regclass
  ) then
    create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();
  end if;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;