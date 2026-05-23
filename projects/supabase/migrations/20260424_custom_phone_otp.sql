create table if not exists public.phone_otp_requests (
  phone text primary key,
  name text,
  otp_hash text not null,
  expires_at timestamptz not null,
  attempts_left integer not null default 3 check (attempts_left >= 0 and attempts_left <= 3),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists phone_otp_requests_expires_at_idx
  on public.phone_otp_requests (expires_at);

drop trigger if exists set_phone_otp_requests_updated_at on public.phone_otp_requests;
create trigger set_phone_otp_requests_updated_at
before update on public.phone_otp_requests
for each row execute function public.set_updated_at();

alter table public.phone_otp_requests enable row level security;
