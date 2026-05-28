# SQL Database Chatbot

A secure, safety-first assistant that converts natural-language questions into validated, read-only SQL queries, executes them against a database, and returns human-friendly results and explanations.

## Live Demo 
Try it here - https://sql-database-chatbot.vercel.app/

## Video Demo
https://github.com/user-attachments/assets/ff530eae-0bb7-4ed1-b8eb-65411a0c35aa

## Overview

This repository contains a full-stack AI-powered SQL chatbot that enables users to interact with PostgreSQL and Supabase databases using natural language queries. The application converts human-readable questions into safe SQL statements, validates them against strict security rules, executes only read-only queries, and returns formatted results along with clear explanations.

The project is designed as a secure and developer-friendly demonstration of how Large Language Models (LLMs) can be integrated with relational databases while maintaining strong safety guarantees and transparent query execution.

The system focuses heavily on:

* SQL safety and validation
* Read-only database access
* Schema-aware query generation
* Human-friendly explanations
* Minimal and auditable architecture

The application supports both:

* A hosted demo database for instant testing
* User-provided Supabase/PostgreSQL databases through secure connection URLs

## Tech Stack

| Layer | Technologies Used |
|---|---|
| Frontend | React, Vite, Tailwind CSS, JavaScript |
| Backend | FastAPI, Python, Uvicorn, SQLAlchemy, Psycopg2 |
| AI Integration | Groq API, LLM-based SQL Generation |
| Database | PostgreSQL, Supabase |
| Security & Validation | Custom SQL Validator, Read-Only Database Roles, Query Sanitization |
| API Communication | Axios, REST APIs |
| Testing | Pytest |
| Deployment | Vercel, Render |
| Tooling | npm, pip, Git, GitHub |

### Backend

The backend is built using **FastAPI** and acts as the core orchestration layer for the application.

It is responsible for:

* Receiving natural language questions from the frontend
* Fetching schema context from the connected database
* Generating SQL using the Groq LLM API
* Validating and sanitizing generated SQL queries
* Blocking unsafe SQL operations
* Executing safe read-only queries
* Formatting query results
* Explaining SQL errors in plain English

Key backend modules include:

* SQL validation and sanitization
* Database connection management
* Query execution helpers
* Error explanation engine
* LLM integration layer

The backend is intentionally lightweight and modular, making it easy to audit, extend, and deploy.

### Frontend

The frontend is a modern single-page dashboard application built using:

* React
* Vite
* Tailwind CSS

It provides:

* Chat-style SQL interaction
* Schema visualization
* Generated SQL preview
* Query validation badges
* Query result tables
* Demo database mode
* Custom database connection support

The UI is designed to feel similar to modern AI chat interfaces while still exposing the generated SQL and validation pipeline transparently to the user.


### Database & Read-Only Security

The project includes a helper SQL script:

```text
setup_readonly_user.sql
```

This script demonstrates how to create a restricted PostgreSQL role with:

* SELECT-only access
* No INSERT/UPDATE/DELETE permissions
* Limited schema access

This ensures the chatbot can safely query production-like databases without risking destructive operations.

The application further reinforces security by validating generated SQL before execution.

## Features

### Natural Language → SQL Generation

Users can ask questions in plain English such as:

* Show top 5 customers by revenue
* List books published after 2000
* Show orders with customer names
* Find average sales per month

The AI model converts these questions into executable SQL queries using database schema awareness.

The SQL generation layer is modular and can be replaced with other LLM providers if needed.

### Read-Only Query Execution

The system is designed around a strict read-only execution model.

Security is enforced using:

* Read-only PostgreSQL roles
* SQL validation rules
* Query sanitization
* Restricted execution pipeline

Only safe SELECT queries are allowed.

All destructive operations are blocked before execution.

### SQL Validation & Sanitization

Generated SQL passes through a dedicated validation layer before execution.

The validator blocks:

* INSERT statements
* UPDATE statements
* DELETE statements
* DROP statements
* ALTER statements
* TRUNCATE statements
* Multiple SQL statements
* Dangerous keywords and patterns

Additional protections include:

* Automatic row limits
* Timeout enforcement
* Schema restrictions

This safety-first approach prevents accidental or malicious database modifications.

### Human-Friendly Error Explanations

Database errors are transformed into understandable explanations for non-technical users.

Instead of raw SQL errors, the system explains:

* Why the query failed
* Which table or column is missing
* Whether permissions caused the issue
* How the query can be corrected

This improves usability for beginners and non-technical stakeholders.

### Schema-Aware Query Generation

The backend dynamically fetches:

* Tables
* Columns
* Relationships
* Foreign keys

This schema information is included in the LLM prompt so that generated SQL aligns with the actual database structure.

This greatly improves:

* SQL accuracy
* JOIN handling
* Aggregation correctness
* Relationship understanding

### Demo Database Support

The application includes a hosted demo mode where users can instantly test the chatbot without providing their own database.

The demo database includes:

* Related tables
* Foreign keys
* JOIN-ready datasets
* Analytics-friendly sample data

### Minimal & Auditable Architecture

The project intentionally keeps the architecture lightweight and transparent.

Benefits include:

* Easy deployment
* Easier security review
* Simple debugging
* Extensibility
* Educational value

The repository is structured to make core components easy to understand and modify.

### Unit Testing

Critical backend components are covered with unit tests, including:

* SQL validation
* Configuration handling
* Error explanation logic

This helps ensure the safety layer behaves consistently before deployment.

## Architecture & Workflow
<img width="1536" height="1024" alt="image" src="https://github.com/user-attachments/assets/ce798994-4d45-46e6-994f-e2b349699f64" />


## Project structure
```
SQL_database_chatbot/
│
├── README.md
├── setup_readonly_user.sql
│
├── backend/
│   ├── requirements.txt
│   │
│   ├── app/
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── error_explainer.py
│   │   ├── groq_client.py
│   │   ├── main.py
│   │   ├── models.py
│   │   └── sql_validator.py
│   │
│   └── tests/
│       ├── test_config.py
│       ├── test_error_explainer.py
│       └── test_sql_validator.py
│
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   ├── vite.config.js
│   │
│   ├── scripts/
│   │   └── dev-server.mjs
│   │
│   └── src/
│       ├── main.jsx
│       └── styles.css
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

Contributions are welcome and appreciated.

If you would like to improve the project, feel free to:

* Open an issue to report bugs or suggest new features
* Submit pull requests with improvements or fixes
* Add tests for newly introduced functionality
* Improve documentation or developer experience

When contributing:

* Provide clear and detailed descriptions in issues and pull requests
* Keep commits focused and well-structured
* Follow the existing project structure and coding style
* Add or update tests for any modified validation or security logic
* Ensure all existing tests pass before submitting changes

### Security Guidelines

Because this project interacts with databases and AI-generated SQL, security is extremely important.

Please ensure:

* No secrets, API keys, or database credentials are committed
* Environment variables are used for sensitive configuration
* SQL safety rules remain enforced
* Dangerous or write-capable SQL execution paths are not introduced

All contributions related to:

* SQL validation
* Database execution
* Authentication
* Query sanitization

should be reviewed carefully before merging.



