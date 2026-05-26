from collections import defaultdict
from time import perf_counter
from typing import Any

import psycopg
from psycopg.rows import dict_row

from app.config import Settings
from app.models import ColumnInfo, ForeignKeyInfo, TableInfo


def _connect(settings: Settings):
    settings.require_database()
    conn = psycopg.connect(settings.active_database_url, row_factory=dict_row)
    # Enforce read-only session at the database level
    conn.execute("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY")
    conn.execute("SET transaction_read_only = on")
    return conn


def fetch_schema(settings: Settings) -> list[TableInfo]:
    allowed_schemas = settings.schema_allowlist
    with _connect(settings) as conn:
        with conn.cursor() as cur:
            # Fetch columns and primary keys
            cur.execute(
                """
                SELECT
                    c.table_schema,
                    c.table_name,
                    c.column_name,
                    c.data_type,
                    c.is_nullable,
                    CASE WHEN kcu.column_name IS NULL THEN false ELSE true END AS is_primary_key
                FROM information_schema.columns c
                LEFT JOIN information_schema.table_constraints tc
                    ON tc.table_schema = c.table_schema
                    AND tc.table_name = c.table_name
                    AND tc.constraint_type = 'PRIMARY KEY'
                LEFT JOIN information_schema.key_column_usage kcu
                    ON kcu.constraint_name = tc.constraint_name
                    AND kcu.table_schema = tc.table_schema
                    AND kcu.table_name = tc.table_name
                    AND kcu.column_name = c.column_name
                WHERE c.table_schema = ANY(%s)
                ORDER BY c.table_schema, c.table_name, c.ordinal_position
                """,
                (allowed_schemas,),
            )
            column_rows = cur.fetchall()

            # Fetch foreign keys
            cur.execute(
                """
                SELECT
                    tc.table_schema, 
                    tc.table_name, 
                    kcu.column_name, 
                    ccu.table_schema AS foreign_table_schema,
                    ccu.table_name AS foreign_table_name,
                    ccu.column_name AS foreign_column_name 
                FROM information_schema.table_constraints AS tc 
                JOIN information_schema.key_column_usage AS kcu
                  ON tc.constraint_name = kcu.constraint_name
                  AND tc.table_schema = kcu.table_schema
                JOIN information_schema.constraint_column_usage AS ccu
                  ON ccu.constraint_name = tc.constraint_name
                  AND ccu.table_schema = tc.table_schema
                WHERE tc.constraint_type = 'FOREIGN KEY' 
                  AND tc.table_schema = ANY(%s);
                """,
                (allowed_schemas,),
            )
            fk_rows = cur.fetchall()

    grouped_columns: dict[tuple[str, str], list[ColumnInfo]] = defaultdict(list)
    for row in column_rows:
        grouped_columns[(row["table_schema"], row["table_name"])].append(
            ColumnInfo(
                name=row["column_name"],
                data_type=row["data_type"],
                is_nullable=row["is_nullable"] == "YES",
                is_primary_key=row["is_primary_key"],
            )
        )

    grouped_fks: dict[tuple[str, str], list[ForeignKeyInfo]] = defaultdict(list)
    for row in fk_rows:
        grouped_fks[(row["table_schema"], row["table_name"])].append(
            ForeignKeyInfo(
                column_name=row["column_name"],
                foreign_table_schema=row["foreign_table_schema"],
                foreign_table_name=row["foreign_table_name"],
                foreign_column_name=row["foreign_column_name"],
            )
        )

    return [
        TableInfo(
            schema_name=schema, 
            table_name=table, 
            columns=columns,
            foreign_keys=grouped_fks.get((schema, table), [])
        )
        for (schema, table), columns in grouped_columns.items()
    ]


def format_schema_for_prompt(tables: list[TableInfo]) -> str:
    if not tables:
        return "No database schema was found."
    lines: list[str] = []
    for table in tables:
        columns = []
        for col in table.columns:
            marker = " PRIMARY KEY" if col.is_primary_key else ""
            columns.append(f"{col.name} {col.data_type}{marker}")
        
        fk_lines = []
        for fk in table.foreign_keys:
            fk_lines.append(f"FOREIGN KEY ({fk.column_name}) REFERENCES {fk.foreign_table_schema}.{fk.foreign_table_name}({fk.foreign_column_name})")
        
        table_def = f"Table {table.schema_name}.{table.table_name} (\n  " + ",\n  ".join(columns + fk_lines) + "\n)"
        lines.append(table_def)
    
    return "\n\n".join(lines)


def execute_query(settings: Settings, sql: str) -> tuple[list[str], list[dict[str, Any]], int]:
    with _connect(settings) as conn:
        with conn.cursor() as cur:
            cur.execute(f"SET LOCAL statement_timeout = {settings.query_timeout_seconds * 1000}")
            started = perf_counter()
            cur.execute(sql)
            rows = cur.fetchall()
            elapsed_ms = int((perf_counter() - started) * 1000)
            columns = [desc.name for desc in cur.description or []]
    return columns, rows, elapsed_ms
