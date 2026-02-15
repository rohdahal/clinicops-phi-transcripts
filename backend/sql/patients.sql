create extension if not exists "pgcrypto";

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  pseudonym text not null unique,
  full_name text,
  masked_name text,
  patient_profile_image_url text,

  email text,
  email_masked text,
  email_verified boolean not null default false,

  phone text,
  phone_masked text,
  phone_verified boolean not null default false,

  preferred_channel text not null default 'phone',
  contact_ok boolean not null default true,

  consent_status text not null default 'unknown',
  consent_source text,
  consent_at timestamptz,

  meta jsonb,

  constraint patients_pseudonym_nonempty check (length(trim(pseudonym)) > 0),
  constraint patients_masked_name_nonempty check (
    masked_name is null or length(trim(masked_name)) > 0
  ),
  constraint patients_full_name_nonempty check (
    full_name is null or length(trim(full_name)) > 0
  ),
  constraint patients_preferred_channel_check check (
    preferred_channel in ('phone', 'email', 'sms', 'none')
  ),
  constraint patients_consent_status_check check (
    consent_status in ('unknown', 'granted', 'revoked', 'pending')
  )
);

create index if not exists patients_pseudonym_idx
  on public.patients (pseudonym);

alter table public.transcripts
  add column if not exists patient_id uuid references public.patients (id) on delete set null;

create index if not exists transcripts_patient_id_idx
  on public.transcripts (patient_id);

insert into public.patients (pseudonym, masked_name, meta)
select distinct
  t.patient_pseudonym,
  t.patient_pseudonym,
  jsonb_build_object('backfilled_from', 'transcripts')
from public.transcripts t
where length(trim(t.patient_pseudonym)) > 0
on conflict (pseudonym) do nothing;

update public.transcripts t
set patient_id = p.id
from public.patients p
where t.patient_id is null
  and p.pseudonym = t.patient_pseudonym;
