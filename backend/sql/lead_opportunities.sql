create extension if not exists "pgcrypto";

create table if not exists public.lead_opportunities (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  transcript_id uuid not null unique references public.transcripts (id) on delete cascade,
  source_artifact_id uuid references public.transcript_artifacts (id) on delete set null,
  model text not null default 'qwen2.5:1.5b',

  title text not null,
  reason text not null,
  next_action text not null,
  lead_score numeric(4,3) not null default 0.5,
  status text not null default 'open',

  owner_user_id uuid,
  due_at timestamptz,
  last_contacted_at timestamptz,
  notes text,
  meta jsonb,

  constraint lead_opportunities_model_nonempty check (length(trim(model)) > 0),
  constraint lead_opportunities_title_nonempty check (length(trim(title)) > 0),
  constraint lead_opportunities_reason_nonempty check (length(trim(reason)) > 0),
  constraint lead_opportunities_next_action_nonempty check (length(trim(next_action)) > 0),
  constraint lead_opportunities_score_range check (lead_score >= 0 and lead_score <= 1),
  constraint lead_opportunities_status_check check (
    status in (
      'open',
      'in_progress',
      'contacted',
      'qualified',
      'closed_won',
      'closed_lost',
      'dismissed',
      'superseded'
    )
  )
);

create index if not exists lead_opportunities_transcript_idx
  on public.lead_opportunities (transcript_id, created_at desc);

create index if not exists lead_opportunities_status_due_idx
  on public.lead_opportunities (status, due_at);
