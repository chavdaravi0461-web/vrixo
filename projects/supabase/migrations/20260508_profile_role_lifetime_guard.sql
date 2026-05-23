begin;

alter table if exists public.profiles
  add column if not exists role text not null default 'customer';

alter table if exists public.profiles
  alter column role set default 'customer';

update public.profiles
set role = 'customer'
where role is null
   or role not in ('customer', 'admin');

alter table if exists public.profiles
  alter column role set not null;

alter table if exists public.profiles
  drop constraint if exists profiles_role_check;

alter table if exists public.profiles
  add constraint profiles_role_check check (role in ('customer', 'admin'));

create or replace function public.is_admin(user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = user_id
      and role = 'admin'
      and coalesce(is_active, true) = true
      and lower(coalesce(email, '')) = 'chavdaravi0461@gmail.com'
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin(auth.uid());
$$;

grant execute on function public.is_admin(uuid) to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;

create or replace function public.enforce_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_service_context boolean := coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    or current_user in ('postgres', 'supabase_admin', 'service_role')
    or session_user in ('postgres', 'supabase_admin', 'service_role');
  profile_email text;
  is_owner_admin_profile boolean;
begin
  if tg_op = 'INSERT' then
    profile_email := new.email;
  else
    profile_email := coalesce(new.email, old.email);
  end if;

  is_owner_admin_profile := lower(coalesce(profile_email, '')) = 'chavdaravi0461@gmail.com'
    and new.role = 'admin';

  if tg_op = 'INSERT' then
    if not (is_service_context and is_owner_admin_profile) then
      new.role := 'customer';
    end if;

    return new;
  end if;

  if tg_op = 'UPDATE' and new.role is distinct from old.role then
    if new.role not in ('customer', 'admin')
      or (new.role = 'admin' and not is_owner_admin_profile)
      or (not is_service_context and not public.is_admin(auth.uid()))
    then
      new.role := old.role;
    end if;
  end if;

  if new.role is null or new.role not in ('customer', 'admin') then
    new.role := coalesce(old.role, 'customer');
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_non_admin_role_change_trigger on public.profiles;
drop trigger if exists zzzzzz_enforce_profile_role on public.profiles;

create trigger zzzzzz_enforce_profile_role
before insert or update of role on public.profiles
for each row
execute function public.enforce_profile_role();

do $$
declare
  r record;
begin
  for r in
    select t.tgname
    from pg_trigger t
    join pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = 'auth.users'::regclass
      and not t.tgisinternal
      and (
        p.proname ilike '%profile%'
        or p.proname ilike '%new_user%'
        or pg_get_functiondef(p.oid) ilike '%public.profiles%'
      )
  loop
    execute format('drop trigger if exists %I on auth.users', r.tgname);
  end loop;
end $$;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_email text := nullif(new.email, '');
  profile_phone text := coalesce(
    nullif(new.phone, ''),
    nullif(new.raw_user_meta_data ->> 'phone', '')
  );
begin
  insert into public.profiles (id, name, email, phone, role, is_active)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'name', ''),
      case
        when profile_email is not null then split_part(profile_email, '@', 1)
        when profile_phone is not null then 'Customer ' || right(regexp_replace(profile_phone, '\D', '', 'g'), 4)
        else 'Customer'
      end
    ),
    profile_email,
    profile_phone,
    'customer',
    true
  )
  on conflict (id) do update
  set
    name = coalesce(nullif(excluded.name, ''), public.profiles.name),
    email = coalesce(excluded.email, public.profiles.email),
    phone = coalesce(excluded.phone, public.profiles.phone),
    is_active = coalesce(public.profiles.is_active, true);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;

create trigger on_auth_user_created_profile
after insert on auth.users
for each row
execute function public.handle_new_user_profile();

commit;
