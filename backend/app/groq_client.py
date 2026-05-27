import json
import re

import httpx

from app.config import Settings


SYSTEM_PROMPT = """You convert natural language questions into safe PostgreSQL SELECT SQL.
Return only compact JSON with keys: sql, explanation, assumptions, visualization.

Rules:
- Generate one PostgreSQL SELECT query only.
- Do not include comments, markdown, backticks, semicolons, DML, or DDL.
- Prefer clear aliases for calculated columns.
- Use the provided schema only; do not invent tables.
- **Join Awareness**: Use the provided FOREIGN KEY relationships to perform multi-table joins when the question requires information from multiple tables.
- **Date Handling**: If a column is stored as text but represents a date, cast it explicitly (e.g., column::date).
- **Security**: You are in a read-only environment. Only SELECT queries are permitted.
- **Visualization**: Suggest a chart type (bar, line, pie, or table) based on the query results.
  The 'visualization' key should be an object: { "type": "bar" | "line" | "pie" | "table", "x_axis": "column_name", "y_axis": "column_name", "title": "Chart Title" }
  - Use 'bar' for categorical comparisons or counts.
  - Use 'line' for trends over time (when a date/timestamp column is involved).
  - Use 'pie' for part-to-whole relationships (e.g., percentages, distribution).
  - Use 'table' if no visualization makes sense.
"""


def _extract_json(content: str) -> dict:
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", content, flags=re.DOTALL)
        if not match:
            raise ValueError("Groq did not return JSON.")
        return json.loads(match.group(0))


async def generate_sql(settings: Settings, question: str, schema_context: str) -> dict:
    settings.require_groq()
    payload = {
        "model": settings.groq_model,
        "temperature": 0.1,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"Schema:\n{schema_context}\n\nQuestion:\n{question}",
            },
        ],
    }
    headers = {
        "Authorization": f"Bearer {settings.groq_api_key}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers=headers,
            json=payload,
        )
        response.raise_for_status()
    content = response.json()["choices"][0]["message"]["content"]
    data = _extract_json(content)
    return {
        "sql": str(data.get("sql", "")).strip(),
        "explanation": str(data.get("explanation", "")).strip(),
        "assumptions": data.get("assumptions") if isinstance(data.get("assumptions"), list) else [],
        "visualization": data.get("visualization") if isinstance(data.get("visualization"), dict) else {"type": "table"},
    }


async def explain_error(settings: Settings, error: str, sql: str, schema_context: str) -> str:
    settings.require_groq()
    prompt = f"""The following SQL query failed:
SQL: {sql}
Error: {error}

Context (Schema):
{schema_context}

Explain why this query failed in simple natural language for a non-technical user. 
Keep it concise (1-2 sentences). 
Example: "Your query failed because the column 'revenu' doesn't exist in the 'orders' table. You might have meant 'revenue'."
"""
    payload = {
        "model": settings.groq_model,
        "temperature": 0.1,
        "messages": [
            {"role": "system", "content": "You are a helpful database assistant that explains technical SQL errors in simple terms."},
            {"role": "user", "content": prompt},
        ],
    }
    headers = {
        "Authorization": f"Bearer {settings.groq_api_key}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers=headers,
            json=payload,
        )
        response.raise_for_status()
    return response.json()["choices"][0]["message"]["content"].strip()
