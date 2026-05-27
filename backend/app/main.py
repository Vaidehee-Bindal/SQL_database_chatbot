from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import execute_query, fetch_schema, format_schema_for_prompt
from app.error_explainer import explain_sql_error_locally
from app.groq_client import explain_error, generate_sql
from app.models import ChatResponse, ConnectionRequest, HistoryItem, LoginRequest, LoginResponse, QueryRequest, SavedConnection, SavedConnectionRequest, SelectTablesRequest, TableInfo, VisualizationHint
# from app.auth import login, register_user, save_connection, get_connection, list_connections, delete_connection, verify_token
from app.sql_validator import validate_exact_table_mentions, validate_requested_schema_terms, validate_select_sql

app = FastAPI(title="SQL Database Chatbot API", version="0.1.0")
settings = get_settings()
history: list[HistoryItem] = []


def verify_token(token: str) -> str | None:
    # Auth is currently optional in this branch; keep chat/query running even if auth helpers are not wired.
    return None


def settings_for_database_url(database_url: str | None):
    if not database_url:
        return settings
    from app.config import Settings

    return Settings(
        GROQ_API_KEY=settings.groq_api_key,
        GROQ_MODEL=settings.groq_model,
        SUPABASE_DATABASE_URL=database_url,
        QUERY_ROW_LIMIT=settings.query_row_limit,
        QUERY_TIMEOUT_SECONDS=settings.query_timeout_seconds,
        ALLOWED_SCHEMAS=settings.allowed_schemas,
        FRONTEND_ORIGIN=settings.frontend_origin,
    )


def get_current_user(authorization: str | None) -> str:
    """Extract and verify user from Authorization header."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization")
    token = authorization.split(" ", 1)[1]
    username = verify_token(token)
    if not username:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return username

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


"""
@app.post("/register", response_model=dict)
def register(request: LoginRequest) -> dict:
    try:
        return register_user(request.username, request.password)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/login", response_model=LoginResponse)
def login_user(request: LoginRequest) -> LoginResponse:
    try:
        token = login(request.username, request.password)
        return LoginResponse(
            token=token,
            username=request.username,
            message="Login successful"
        )
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc


@app.post("/save-connection", response_model=SavedConnection)
def save_db_connection(
    request: SavedConnectionRequest,
    authorization: str | None = None
) -> SavedConnection:
    username = get_current_user(authorization)
    try:
        return save_connection(username, request.name, request.database_url, request.description)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/connections", response_model=list[SavedConnection])
def get_connections(authorization: str | None = None) -> list[SavedConnection]:
    username = get_current_user(authorization)
    return list_connections(username)


@app.delete("/connections/{connection_id}")
def delete_db_connection(
    connection_id: str,
    authorization: str | None = None
) -> dict:
    username = get_current_user(authorization)
    try:
        return delete_connection(username, connection_id)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
"""

@app.get("/health")
def health() -> dict[str, str | bool]:
    return {
        "ok": True,
        "groq_configured": bool(settings.groq_api_key),
        "database_configured": bool(settings.active_database_url),
    }


@app.post("/test-connection", response_model=dict[str, bool])
def test_connection(request: ConnectionRequest) -> dict[str, bool]:
    try:
        fetch_schema(settings_for_database_url(request.database_url))
        return {"connected": True}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/get-tables", response_model=list[TableInfo])
def get_tables(request: ConnectionRequest) -> list[TableInfo]:
    try:
        return fetch_schema(settings_for_database_url(request.database_url))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/schema", response_model=list[TableInfo])
def schema() -> list[TableInfo]:
    try:
        return fetch_schema(settings)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/history", response_model=list[HistoryItem])
def query_history() -> list[HistoryItem]:
    return history[-25:][::-1]


@app.post("/chat/query", response_model=ChatResponse)
async def chat_query(request: QueryRequest) -> ChatResponse:
    try:
        query_settings = settings_for_database_url(request.database_url)
        tables = fetch_schema(query_settings)

        if request.selected_tables:
            tables = [t for t in tables if f"{t.schema_name}.{t.table_name}" in request.selected_tables]
        schema_context = format_schema_for_prompt(tables)

        table_names = [table.table_name for table in tables]
        query_validation = validate_exact_table_mentions(request.question, table_names)
        if not query_validation.valid:
            return ChatResponse(
                question=request.question,
                error=query_validation.reason or "Use the exact table name.",
                error_explanation=query_validation.reason or "Use the exact table name.",
                validation=query_validation,
                created_at=datetime.now(timezone.utc),
            )

        schema_term_validation = validate_requested_schema_terms(request.question, tables)
        if not schema_term_validation.valid:
            return ChatResponse(
                question=request.question,
                error=schema_term_validation.reason or "The query asks for a column that does not exist in the selected schema.",
                error_explanation=schema_term_validation.reason or "The query asks for a column that does not exist in the selected schema.",
                validation=schema_term_validation,
                created_at=datetime.now(timezone.utc),
            )

        # Let the model interpret the natural-language question against the live schema.
        # We only enforce SQL safety after generation so unfamiliar schemas can still work.
        generation = await generate_sql(query_settings, request.question, schema_context)
        validation = validate_select_sql(generation["sql"], query_settings.query_row_limit)
        
        if not validation.valid or not validation.executable_sql or not validation.normalized_sql:
            # If SQL is invalid, try to explain why (if we have SQL)
            error_explanation = None
            if generation.get("sql"):
                error_explanation = await explain_error(
                    query_settings, 
                    validation.reason or "SQL validation failed", 
                    generation["sql"], 
                    schema_context
                )
            return ChatResponse(
                question=request.question,
                sql=generation.get("sql"),
                explanation=generation.get("explanation"),
                error=validation.reason or "Invalid SQL generated",
                error_explanation=error_explanation,
                validation=validation,
                created_at=datetime.now(timezone.utc)
            )

        try:
            columns, rows, elapsed_ms = execute_query(query_settings, validation.executable_sql)
            created_at = datetime.now(timezone.utc)
            response = ChatResponse(
                question=request.question,
                sql=validation.normalized_sql,
                executable_sql=validation.executable_sql,
                explanation=generation["explanation"],
                assumptions=[str(item) for item in generation["assumptions"]],
                validation=validation,
                columns=columns,
                rows=rows,
                row_count=len(rows),
                elapsed_ms=elapsed_ms,
                visualization=VisualizationHint(**generation["visualization"]),
                created_at=created_at,
            )
            history.append(
                HistoryItem(
                    question=request.question,
                    sql=response.sql,
                    row_count=response.row_count,
                    elapsed_ms=response.elapsed_ms,
                    created_at=created_at,
                )
            )
            return response
        except Exception as query_exc:
            # Handle runtime SQL errors
            error_explanation = explain_sql_error_locally(str(query_exc), tables)
            if not error_explanation:
                error_explanation = await explain_error(
                    query_settings,
                    str(query_exc),
                    validation.executable_sql,
                    schema_context
                )
            return ChatResponse(
                question=request.question,
                sql=validation.normalized_sql,
                executable_sql=validation.executable_sql,
                explanation=generation["explanation"],
                error=str(query_exc),
                error_explanation=error_explanation,
                validation=validation,
                created_at=datetime.now(timezone.utc)
            )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
