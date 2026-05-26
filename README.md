# SQL Database Chatbot

Dark-mode SQL chatbot MVP with a FastAPI backend, Groq-powered SQL generation, Supabase/PostgreSQL schema grounding, SELECT-only validation, and a React dashboard UI.

## Project Structure

```text
backend/   FastAPI API, Groq client, Postgres execution, SQL safety tests
frontend/  React + Vite + Tailwind dashboard
```

## Setup

Install backend dependencies:

```powershell
& 'C:\Users\vaide\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m pip install -r backend\requirements.txt
```

Install frontend dependencies:

```powershell
cd frontend
npm install
```

## Environment

Create `backend/.env` from `backend/.env.example` and add your real values:

```env
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile
SUPABASE_DATABASE_URL=postgresql://postgres.project-ref:password@aws-0-region.pooler.supabase.com:6543/postgres?sslmode=require
QUERY_ROW_LIMIT=1000
QUERY_TIMEOUT_SECONDS=15
FRONTEND_ORIGIN=http://localhost:5174
ALLOWED_SCHEMAS=public
```

Use Supabase's pooled PostgreSQL connection string from Project Settings. Keep `?sslmode=require` at the end. If your password has special characters like `@`, `#`, `%`, or `/`, URL-encode the password before pasting it.

For production, use a read-only Supabase/PostgreSQL role. The app also blocks non-SELECT SQL, multiple statements, comments, and dangerous DML/DDL keywords before execution.

`DATABASE_URL` is still supported, but `SUPABASE_DATABASE_URL` is preferred for this project.

By default the chatbot only introspects the `public` schema so Supabase internal schemas such as `auth` are not sent to Groq. To allow more schemas, set `ALLOWED_SCHEMAS=public,analytics`.

## Run

Start the backend:

```powershell
cd backend
& 'C:\Users\vaide\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Start the frontend:

```powershell
cd frontend
npm run dev
```

Open `http://127.0.0.1:5174`.

## Verify

```powershell
$env:PYTHONPATH='backend'
& 'C:\Users\vaide\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m pytest backend\tests -q
cd frontend
npm run build
```
