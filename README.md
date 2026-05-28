# SQL Database Chatbot

A secure, safety-first assistant that converts natural-language questions into validated, read-only SQL queries, executes them against a database, and returns human-friendly results and explanations.

## Live Demo 
Try it here - https://sql-database-chatbot.vercel.app/

## Overview

This repository contains a small full-stack demo that demonstrates how to expose safe, read-only database querying via natural-language prompts.

- Backend: FastAPI service with SQL validation, execution helpers, and error explanation components.
- Frontend: Vite + React single-page UI for asking questions and viewing results.
- DB helper: `setup_readonly_user.sql` shows how to create a restricted read-only role.

## Features

- Natural-language → SQL generation (pluggable/replaceable component)
- Read-only execution enforced by validator + DB role
- SQL validation and sanitization to block DDL/DML and multiple statements
- Human-friendly error explanations for database errors
- Minimal, auditable codebase and unit tests for critical paths

## Architecture & Workflow

```mermaid
flowchart TD
  U[User] -->|asks question| F[Frontend]
  F -->|POST /query| A[Backend API]
  A --> G[NL→SQL generator]
  G --> V[SQL Validator]
  V -->|valid| DB[DB (read-only)]
  V -->|invalid| R[Reject + Explain]
  DB --> R2[Result Formatter]
  R2 --> E[Error Explainer / Natural language]
  E --> F
  R --> F
```

## Project structure

Top-level layout:

```
README.md
setup_readonly_user.sql
backend/
  requirements.txt
  app/
    __init__.py
    auth.py
    config.py
    database.py
    error_explainer.py
    groq_client.py
    main.py
    models.py
    sql_validator.py
tests/
  test_config.py
  test_error_explainer.py
  test_sql_validator.py
frontend/
  index.html
  package.json
  postcss.config.js
  tailwind.config.js
  vite.config.js
  scripts/
    dev-server.mjs
  src/
    main.jsx
    styles.css
```

## Project Structure Explaination

| Path | Purpose |
|------|---------|
| README.md | Project overview, setup, and usage (this file). |
| setup_readonly_user.sql | SQL script to create a read-only DB user and permissions. |
| backend/requirements.txt | Python dependencies for the backend. |
| backend/app/__init__.py | Package initialization. |
| backend/app/auth.py | Authentication helpers (if used). |
| backend/app/config.py | Environment/config handling (DB strings, timeouts). |
| backend/app/database.py | DB connection helpers and execution wrapper. |
| backend/app/error_explainer.py | Convert DB errors into human-readable messages. |
| backend/app/groq_client.py | External NL→SQL model client (if present). |
| backend/app/main.py | FastAPI app and route handlers. |
| backend/app/models.py | Pydantic request/response schemas. |
| backend/app/sql_validator.py | Core SQL validation and sanitization logic. |
| tests/*.py | Unit tests for backend components. |
| frontend/index.html | Frontend entry HTML. |
| frontend/package.json | Frontend dependencies and scripts. |
| frontend/src/main.jsx | React entry point and UI wiring. |
| frontend/src/styles.css | Global styles and Tailwind imports. |

## Security

- Use the provided `setup_readonly_user.sql` to create a database user with only read privileges.
- Validator blocks: non-SELECT statements, multiple statements, comments, and dangerous keywords (DROP, DELETE, UPDATE, INSERT, ALTER, etc.).
- Store secrets and DB credentials server-side and use environment variables (do not commit secrets).
- Keep query logs minimal and redact PII before persistence.

## Quick start

Clone and install:

```bash
git clone https://github.com/Vaidehee-Bindal/SQL_database_chatbot.git
cd SQL_database_chatbot

# Backend
python -m venv .venv
# Windows PowerShell activate: .venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r backend/requirements.txt

# Frontend (separate terminal)
cd frontend
npm install
```

Run locally:

```bash
# start backend from repo root
uvicorn backend.app.main:app --reload

# start frontend (from frontend/)
npm run dev
```

Open the frontend at `http://localhost:5174` (Vite default) or the address printed by `npm run dev`.

## Environment variables

Create `backend/.env` (or set env vars) with the values your deployment needs. Common vars:

```env
GROQ_API_KEY=
GROQ_MODEL=
SUPABASE_DATABASE_URL=
QUERY_ROW_LIMIT=1000
QUERY_TIMEOUT_SECONDS=15
FRONTEND_ORIGIN=http://localhost:5174
ALLOWED_SCHEMAS=public
```

Notes:
- Prefer a read-only DB role in production.
- URL-encode special characters in connection passwords.
- `SUPABASE_DATABASE_URL` is used in this project when targeting Supabase; `DATABASE_URL` is also supported.

## Tests

Run backend tests:

```bash
pytest -q
```

## Contributing

- Open issues or PRs with clear descriptions and tests for new behaviors.
- Keep secrets out of commits and add tests for validation rules you change.



