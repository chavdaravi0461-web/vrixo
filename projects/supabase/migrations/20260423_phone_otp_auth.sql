alter table public.profiles
alter column email drop not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
declare
  profile_email text := nullif(new.email, '');
  profile_phone text := coalesce(
    nullif(new.phone, ''),
    nullif(new.raw_user_meta_data ->> 'phone', '')
  );
begin
  insert into public.profiles (id, name, email, phone)
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
    profile_phone
  )
  on conflict (id) do update
  set
    name = coalesce(nullif(excluded.name, ''), public.profiles.name),
    email = coalesce(excluded.email, public.profiles.email),
    phone = coalesce(excluded.phone, public.profiles.phone);
  return new;
end;
$$;
