create extension if not exists "pgcrypto";

drop table if exists public.audit_events;

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  entity_type text not null,      
  entity_id uuid not null,        

  actor_type text not null,       
  actor_display text not null,    
  actor_id uuid,                 

  action text not null,           
  details jsonb              
);

create index if not exists audit_events_entity_idx
  on public.audit_events (entity_type, entity_id, created_at desc);
