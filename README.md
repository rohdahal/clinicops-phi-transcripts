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

## Backend transcript endpoints
```bash
curl http://localhost:3001/v1/transcripts
curl http://localhost:3001/v1/transcripts/<uuid>
curl -X POST http://localhost:3001/v1/transcripts \
  -H "content-type: application/json" \
  -d '{"patient_pseudonym":"PT-1029","source":"call","text":"hello","idempotency_key":"demo_1"}'
```
