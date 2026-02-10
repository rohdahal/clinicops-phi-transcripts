create extension if not exists "pgcrypto";

create table if not exists transcripts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  patient_pseudonym text not null,
  source text not null,
  source_ref text,
  redacted_text text not null,
  idempotency_key text not null unique,
  meta jsonb,
  constraint transcripts_patient_pseudonym_nonempty check (length(trim(patient_pseudonym)) > 0),
  constraint transcripts_source_nonempty check (length(trim(source)) > 0),
  constraint transcripts_idempotency_key_nonempty check (length(trim(idempotency_key)) > 0)
);

create index if not exists transcripts_created_at_desc_idx
  on transcripts (created_at desc);

create index if not exists transcripts_patient_pseudonym_idx
  on transcripts (patient_pseudonym);

create index if not exists transcripts_source_idx
  on transcripts (source);
