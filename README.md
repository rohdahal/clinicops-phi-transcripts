# ClinicOps PHI Transcript Ops

Clinic operations console for transcript review and follow-up execution.  

## Features
- Transcript inbox and transcript detail review.
- Unified **Process transcript** flow (LLM summary + lead generation).
- Lead command center on dashboard with follow-up actions.
- Per-transcript lead panel for regeneration and status updates.
- Audit logging for transcript operations and processing actions.

## Processing workflow
- Open a transcript detail page and run **Process transcript**.
- Select model, process, then review generated summary + lead output.
- Approve to mark transcript as processed.
- If needed, regenerate leads from transcript detail with a chosen model.

## Lead rules
- One lead per transcript (`transcript_id` is unique in `lead_opportunities`).
- Regeneration updates existing lead via upsert (no duplicate lead rows).
- Lead generation model is persisted in `lead_opportunities.model`.
- `next_action` is provider-side follow-up focused on revisit intent.

## Where work happens
- **Dashboard**: lead command center and follow-up queue.
- **Transcript detail**: process flow, generated summary, lead panel, and lead status actions.

## Vision

ClinicOps is designed to evolve from transcript review into an
LLM-orchestrated follow-up system for clinical operations.

The long-term goal is to move beyond surfacing insights and toward
**closing the loop on patient follow-ups**, with clinicians always in control.

## Prerequisites
- Node.js
- npm
- Docker (for local Ollama)

## Run backend
```bash
cd backend
npm install
npm run dev
```

## Run frontend
```bash
cd frontend
npm install
npm run dev
```

## Local LLM (Ollama)
```bash
docker compose up -d
docker exec -it clinicops-ollama ollama pull qwen2.5:1.5b
docker exec -it clinicops-ollama ollama pull llama3.2:1b
```

## Seed demo data
`npm run seed` always loads sample transcript, artifact, lead, and audit rows.

Schema setup choices:
- Option A: Create tables manually in Supabase SQL Editor (run in this order to satisfy foreign keys):
  - `backend/sql/transcripts.sql`
  - `backend/sql/transcript_artifacts.sql`
  - `backend/sql/audit_events.sql`
  - `backend/sql/lead_opportunities.sql`
- Option B: Let `npm run seed` apply schema SQL automatically by setting `SUPABASE_DB_URL`.

```bash
cd backend
npm install
npm run seed
```

Useful variant:

```bash
# Use a custom JSON file
npm run seed -- --file seed/demo-seed.json
```

Default seed source file:
- `backend/seed/demo-seed.json`

Notes:
- Seeding always requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `backend/.env`.
- `SUPABASE_DB_URL` is optional and only needed for automatic schema setup via `npm run seed`.
- `SUPABASE_DB_URL` must be copied from Supabase Database connection settings:
  - Connection String -> Type: `URI`
  - Source: `Primary Database`
  - Method: `Session Pooler`
- When `SUPABASE_DB_URL` is present, `npm run seed` executes:
  - `backend/sql/transcripts.sql`
  - `backend/sql/transcript_artifacts.sql`
  - `backend/sql/audit_events.sql`
  - `backend/sql/lead_opportunities.sql`
  - then JSON seed upserts from `backend/seed/demo-seed.json`
- When `SUPABASE_DB_URL` is missing, `npm run seed` skips SQL files and only attempts JSON seed upserts (tables must already exist).
- The script is idempotent (`upsert`) and safe to rerun.
- For SQL bootstrap, seed uses local `psql` if available; otherwise it falls back to `docker compose exec pg-client psql`.
- If you rely on the Docker fallback, run `docker compose up -d` first so `pg-client` is running.

Environment variables are defined using example files. Copy `.env.example` to `backend/.env` and `frontend/.env.local` and fill in the required values. These env files are not committed.
