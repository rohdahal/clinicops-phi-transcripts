create extension if not exists "pgcrypto";

create table if not exists public.transcript_artifacts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  transcript_id uuid not null,

  artifact_type text not null,
  model text not null,
  status text not null default 'generated',

  content text not null,
  meta jsonb,

  approved_at timestamptz,
  approved_by uuid,

  constraint transcript_artifacts_type_nonempty check (length(trim(artifact_type)) > 0),
  constraint transcript_artifacts_model_nonempty check (length(trim(model)) > 0),
  constraint transcript_artifacts_content_nonempty check (length(trim(content)) > 0),
  constraint transcript_artifacts_status_check check (status in ('generated','approved'))
);

create index if not exists transcript_artifacts_transcript_idx
  on public.transcript_artifacts (transcript_id, created_at desc);

alter table public.transcript_artifacts
  add constraint transcript_artifacts_transcript_fk
  foreign key (transcript_id) references public.transcripts (id)
  on delete cascade;
