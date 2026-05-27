from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=6, max_length=100)


class LoginResponse(BaseModel):
    token: str
    username: str
    message: str


class SavedConnectionRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    database_url: str = Field(min_length=10)
    description: str | None = None


class SavedConnection(BaseModel):
    id: str
    name: str
    description: str | None = None
    created_at: datetime
    masked_url: str  # e.g., "postgresql://user@host:5432/..."


class ConnectionRequest(BaseModel):
    database_url: str = Field(min_length=10)


class SelectTablesRequest(BaseModel):
    database_url: str = Field(min_length=10)
    selected_tables: list[str] = Field(default_factory=list)


class QueryRequest(BaseModel):
    question: str = Field(min_length=2, max_length=1000)
    connection_id: str | None = None  # Use saved connection instead of URL
    database_url: str | None = Field(default=None, min_length=10)
    selected_tables: list[str] = Field(default_factory=list)


class ValidationResult(BaseModel):
    valid: bool
    normalized_sql: str | None = None
    executable_sql: str | None = None
    badges: list[str] = []
    reason: str | None = None


class ColumnInfo(BaseModel):
    name: str
    data_type: str
    is_nullable: bool
    is_primary_key: bool = False


class ForeignKeyInfo(BaseModel):
    column_name: str
    foreign_table_schema: str
    foreign_table_name: str
    foreign_column_name: str


class TableInfo(BaseModel):
    schema_name: str
    table_name: str
    columns: list[ColumnInfo]
    foreign_keys: list[ForeignKeyInfo] = Field(default_factory=list)


class VisualizationHint(BaseModel):
    type: str  # "bar", "pie", "line", "table"
    x_axis: str | None = None
    y_axis: str | None = None
    title: str | None = None


class ChatResponse(BaseModel):
    question: str
    sql: str | None = None
    executable_sql: str | None = None
    explanation: str | None = None
    error: str | None = None
    error_explanation: str | None = None
    assumptions: list[str] = []
    validation: ValidationResult | None = None
    columns: list[str] = []
    rows: list[dict[str, Any]] = []
    row_count: int = 0
    elapsed_ms: int = 0
    visualization: VisualizationHint | None = None
    created_at: datetime


class HistoryItem(BaseModel):
    question: str
    sql: str
    row_count: int
    elapsed_ms: int
    created_at: datetime
