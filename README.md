# ClinicOps PHI Transcript Ops

Lightweight operations console for reviewing transcripts, generating summaries, and managing follow-up leads in clinical workflows. 

## What it does

ClinicOps helps teams turn raw transcripts into actionable next steps.

- Review transcripts in a unified inbox
- Generate LLM-powered summaries
- Extract and track potential follow-up leads
- Manage lead status and provider-side next actions
- Maintain a full audit trail of processing activity

## Core workflow
1. Open a transcript from the inbox
2. Run **Process transcript** (summary + lead generation)
3. Review generated output
4. Approve to mark the transcript as processed
5. Regenerate leads if needed using a different model

## Where work happens
- **Dashboard**: lead command center and follow-up queue.
- **Transcript detail**: processing flow, summary, lead panel, and status updates

## Design intent

ClinicOps is designed to evolve from transcript review into an
LLM-orchestrated follow-up system for clinical operations.

The long-term goal is to move beyond surfacing insights and toward
**closing the loop on patient follow-ups**, with clinicians always in control.

## Prerequisites
- Node.js 22 LTS (recommended)
- npm
- Docker (for local Ollama)

## Node version setup (nvm)
Use Node 22 for both frontend and backend to avoid intermittent dev-server stalls.

```bash
nvm install 22
nvm use 22
node -v
```

Expected output should start with `v22`.

## Run backend
```bash
nvm use 22
cd backend
npm install
npm run dev
```

## Run frontend
```bash
nvm use 22
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
`npm run seed` always loads sample patient, transcript, artifact, lead, and audit rows.

Schema setup choices:
- Option A: Create tables manually in Supabase SQL Editor (run in this order to satisfy foreign keys):
  - `backend/sql/transcripts.sql`
  - `backend/sql/patients.sql`
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
  - `backend/sql/patients.sql`
  - `backend/sql/transcript_artifacts.sql`
  - `backend/sql/audit_events.sql`
  - `backend/sql/lead_opportunities.sql`
  - then JSON seed upserts from `backend/seed/demo-seed.json` in this order:
    - `patients`
    - `transcripts` (linked to `patients` via `patient_id`)
    - `transcript_artifacts`
    - `lead_opportunities`
    - `audit_events`
- When `SUPABASE_DB_URL` is missing, `npm run seed` skips SQL files and only attempts JSON seed upserts (tables must already exist).
- The script is idempotent (`upsert`) and safe to rerun.
- For SQL bootstrap, seed uses local `psql` if available; otherwise it falls back to `docker compose exec pg-client psql`.
- If you rely on the Docker fallback, run `docker compose up -d` first so `pg-client` is running.

Environment variables are defined using example files. Copy `.env.example` to `backend/.env` and `frontend/.env.local` and fill in the required values. These env files are not committed.
