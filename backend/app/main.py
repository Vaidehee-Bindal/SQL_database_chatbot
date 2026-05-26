from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import execute_query, fetch_schema, format_schema_for_prompt
from app.groq_client import generate_sql
from app.models import ChatResponse, ConnectionRequest, HistoryItem, LoginRequest, LoginResponse, QueryRequest, SavedConnection, SavedConnectionRequest, SelectTablesRequest, TableInfo
# from app.auth import login, register_user, save_connection, get_connection, list_connections, delete_connection, verify_token
from app.sql_validator import validate_select_sql

app = FastAPI(title="SQL Database Chatbot API", version="0.1.0")
settings = get_settings()
history: list[HistoryItem] = []


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
        settings.frontend_origin,
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:5176",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
        "http://127.0.0.1:5176",
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
        # Create a temporary settings object with the provided URL
        from app.config import Settings
        temp_settings = Settings(GROQ_API_KEY=settings.groq_api_key, SUPABASE_DATABASE_URL=request.database_url)
        temp_settings.require_database()
        # Try to connect and fetch schema
        fetch_schema(temp_settings)
        return {"connected": True}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/get-tables", response_model=list[TableInfo])
def get_tables(request: ConnectionRequest) -> list[TableInfo]:
    try:
        from app.config import Settings
        temp_settings = Settings(GROQ_API_KEY=settings.groq_api_key, SUPABASE_DATABASE_URL=request.database_url)
        return fetch_schema(temp_settings)
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
        # Use provided database URL or fall back to settings
        from app.config import Settings
        # Connection management is disabled for now
        query_settings = settings
        
        tables = fetch_schema(query_settings)
        
        # Filter tables if selected_tables is provided
        if request.selected_tables:
            tables = [t for t in tables if f"{t.schema_name}.{t.table_name}" in request.selected_tables]
        
        generation = await generate_sql(query_settings, request.question, format_schema_for_prompt(tables))
        validation = validate_select_sql(generation["sql"], query_settings.query_row_limit)
        if not validation.valid or not validation.executable_sql or not validation.normalized_sql:
            raise HTTPException(status_code=400, detail=validation.reason or "Generated SQL was rejected.")

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
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
