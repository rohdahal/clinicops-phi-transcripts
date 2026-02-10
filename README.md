# ClinicOps PHI Transcript Ops

Environment variables are defined using example files. Copy `.env.example` to `backend/.env` and `frontend/.env.local` and fill in the required values. These env files are not committed.

## Prerequisites
- Node.js
- npm

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

## Database setup
Run these SQL files in the Supabase SQL editor:
- `backend/sql/transcripts.sql`
- `backend/sql/transcript_artifacts.sql`
- `backend/sql/audit_events.sql`

## Backend transcript endpoints
```bash
curl http://localhost:3001/v1/transcripts
curl http://localhost:3001/v1/transcripts/<uuid>
curl -X POST http://localhost:3001/v1/transcripts \
  -H "content-type: application/json" \
  -d '{"patient_pseudonym":"PT-1029","source":"call","text":"hello","idempotency_key":"demo_1"}'
```

## Audit logging
- Transcript detail views log to `audit_events` using the Supabase user from `Authorization: Bearer <token>`.
- `/v1/transcripts` and `/v1/transcripts/:id` require a valid access token.
- `/v1/transcripts/:id/audit` returns audit events for the transcript.

## Local LLM (Ollama)
```bash
docker compose up -d
docker exec -it clinicops-ollama ollama pull qwen2.5:1.5b
docker exec -it clinicops-ollama ollama pull llama3.2:1b
```
