import json
import re

import httpx

from app.config import Settings


SYSTEM_PROMPT = """You convert natural language questions into safe PostgreSQL SELECT SQL.
Return only compact JSON with keys: sql, explanation, assumptions.

Rules:
- Generate one PostgreSQL SELECT query only.
- Do not include comments, markdown, backticks, semicolons, DML, or DDL.
- Prefer clear aliases for calculated columns.
- Use the provided schema only; do not invent tables.
- **Join Awareness**: Use the provided FOREIGN KEY relationships to perform multi-table joins when the question requires information from multiple tables.
- **Date Handling**: If a column is stored as text but represents a date, cast it explicitly (e.g., column::date).
- **Security**: You are in a read-only environment. Only SELECT queries are permitted.
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
    }
