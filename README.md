# ClinicOps PHI Transcript Ops

Lightweight ops console for reviewing transcripts, generating summaries, and tracking audit activity with Supabase-backed auth and data.

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

## Database setup
Run these SQL files in the Supabase SQL editor:
- `backend/sql/transcripts.sql`
- `backend/sql/transcript_artifacts.sql`
- `backend/sql/audit_events.sql`

Environment variables are defined using example files. Copy `.env.example` to `backend/.env` and `frontend/.env.local` and fill in the required values. These env files are not committed.
