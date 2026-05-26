import re

from app.models import ValidationResult


DANGEROUS_KEYWORDS = {
    "ALTER",
    "ANALYZE",
    "CALL",
    "COMMIT",
    "CREATE",
    "DELETE",
    "DROP",
    "EXECUTE",
    "GRANT",
    "INSERT",
    "REVOKE",
    "ROLLBACK",
    "SET",
    "TRANSACTION",
    "TRUNCATE",
    "UPDATE",
    "VACUUM",
}


def _strip_trailing_semicolon(sql: str) -> str:
    return sql.strip().removesuffix(";").strip()


def validate_select_sql(sql: str, row_limit: int) -> ValidationResult:
    normalized = _strip_trailing_semicolon(sql)
    if not normalized:
        return ValidationResult(valid=False, reason="Generated SQL is empty.")

    if "--" in normalized or "/*" in normalized or "*/" in normalized:
        return ValidationResult(valid=False, reason="SQL comments are blocked.")

    if ";" in normalized:
        return ValidationResult(valid=False, reason="Multiple SQL statements are blocked.")

    if not re.match(r"^\s*(select|with)\b", normalized, flags=re.IGNORECASE):
        return ValidationResult(valid=False, reason="Only SELECT queries are allowed.")

    tokens = set(re.findall(r"\b[A-Z_]+\b", normalized.upper()))
    blocked = sorted(tokens.intersection(DANGEROUS_KEYWORDS))
    if blocked:
        return ValidationResult(valid=False, reason=f"Blocked dangerous keyword: {', '.join(blocked)}.")

    executable = f"SELECT * FROM ({normalized}) AS chatbot_safe_query LIMIT {row_limit}"
    return ValidationResult(
        valid=True,
        normalized_sql=normalized,
        executable_sql=executable,
        badges=["SELECT only", "No DML", "Single statement", f"Row limited to {row_limit}"],
    )
