from difflib import get_close_matches
import re

from app.models import TableInfo


def _column_names(tables: list[TableInfo]) -> list[str]:
    names: list[str] = []
    for table in tables:
        names.extend(column.name for column in table.columns)
    return sorted(set(names))


def _table_names(tables: list[TableInfo]) -> list[str]:
    return sorted({table.table_name for table in tables})


def _suggest(value: str, choices: list[str]) -> str | None:
    matches = get_close_matches(value, choices, n=1, cutoff=0.65)
    return matches[0] if matches else None


def explain_sql_error_locally(error: str, tables: list[TableInfo]) -> str | None:
    lower_error = error.lower()

    column_match = re.search(r'column (?:"([^"]+)"|([a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*|[a-z_][a-z0-9_]*)) does not exist', lower_error)
    if column_match:
        column = (column_match.group(1) or column_match.group(2)).split(".")[-1]
        suggestion = _suggest(column, _column_names(tables))
        if suggestion:
            return f"Your query failed because column '{column}' doesn't exist. You might have meant '{suggestion}'."
        return f"Your query failed because column '{column}' doesn't exist in the selected database schema."

    relation_match = re.search(r'relation "([^"]+)" does not exist', lower_error)
    if relation_match:
        table = relation_match.group(1).split(".")[-1]
        suggestion = _suggest(table, _table_names(tables))
        if suggestion:
            return f"Your query failed because table '{table}' doesn't exist. You might have meant '{suggestion}'."
        return f"Your query failed because table '{table}' doesn't exist in the selected database schema."

    if "permission denied" in lower_error:
        return "Your query failed because the database user does not have permission to read one of the requested tables."

    if "statement timeout" in lower_error or "canceling statement due to statement timeout" in lower_error:
        return "Your query took too long and was stopped by the configured timeout."

    return None
