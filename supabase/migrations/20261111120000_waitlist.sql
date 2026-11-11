-- Wachtlijst voor early access. RLS aan, geen policies: alleen de service role
-- (die RLS omzeilt) kan lezen en schrijven. anon en authenticated hebben geen rechten.

create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  email text not null,
  company text not null default '',
  industry text not null,
  employees text not null,
  country text not null check (country in ('NL', 'BE')),
  plan text,
  time_pain text not null default '',
  consent boolean not null check (consent)
);

create unique index waitlist_email_lower_idx on public.waitlist (lower(email));

alter table public.waitlist enable row level security;

revoke all on table public.waitlist from anon, authenticated;
