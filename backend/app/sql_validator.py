import re
from difflib import SequenceMatcher

from app.models import TableInfo, ValidationResult


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

INJECTION_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\bunion\b\s*(?:all\s*)?\bselect\b", re.IGNORECASE), "UNION-based injection is blocked."),
    (re.compile(r"\bor\s+1\s*=\s*1\b", re.IGNORECASE), "Tautology-based injection is blocked."),
    (re.compile(r"\band\s+1\s*=\s*1\b", re.IGNORECASE), "Tautology-based injection is blocked."),
    (re.compile(r"\bor\s+true\b", re.IGNORECASE), "Boolean tautology injection is blocked."),
    (re.compile(r"\band\s+true\b", re.IGNORECASE), "Boolean tautology injection is blocked."),
    (re.compile(r"\bpg_sleep\s*\(", re.IGNORECASE), "Time-delay injection functions are blocked."),
    (re.compile(r"\bsleep\s*\(", re.IGNORECASE), "Time-delay injection functions are blocked."),
    (re.compile(r"\bbenchmark\s*\(", re.IGNORECASE), "Time-delay injection functions are blocked."),
    (re.compile(r"\bxp_cmdshell\b", re.IGNORECASE), "Operating-system command injection is blocked."),
]

QUESTION_STOPWORDS = {
    "a",
    "all",
    "an",
    "and",
    "any",
    "as",
    "between",
    "by",
    "count",
    "data",
    "database",
    "day",
    "days",
    "detail",
    "details",
    "each",
    "for",
    "from",
    "get",
    "group",
    "has",
    "have",
    "highest",
    "in",
    "include",
    "including",
    "last",
    "latest",
    "list",
    "month",
    "monthly",
    "months",
    "never",
    "of",
    "on",
    "only",
    "per",
    "placed",
    "recent",
    "show",
    "table",
    "tables",
    "the",
    "this",
    "to",
    "top",
    "total",
    "trend",
    "week",
    "weeks",
    "who",
    "with",
    "year",
    "years",
}


def _strip_trailing_semicolon(sql: str) -> str:
    return sql.strip().removesuffix(";").strip()


def _singular_plural_variants(name: str) -> set[str]:
    variants = {name}
    if name.endswith("ies") and len(name) > 3:
        variants.add(f"{name[:-3]}y")
    if name.endswith("s") and len(name) > 1:
        variants.add(name[:-1])
    else:
        variants.add(f"{name}s")
    return variants


def validate_exact_table_mentions(question: str, table_names: list[str]) -> ValidationResult:
    if not table_names:
        return ValidationResult(valid=True, badges=["Exact table names skipped"])

    tokens = re.findall(r"[a-z0-9_]+", question.lower())
    table_names_lower = [name.lower() for name in table_names]
    table_name_set = set(table_names_lower)
    allowed_table_spellings = set()
    for table_name in table_names_lower:
        allowed_table_spellings.update(_singular_plural_variants(table_name))
    relation_tokens = {"of", "by", "from", "join", "with", "in", "on", "table", "tables"}

    close_matches: list[tuple[str, str]] = []
    for index, token in enumerate(tokens):
        if token in allowed_table_spellings:
            continue

        previous_token = tokens[index - 1] if index > 0 else ""
        next_token = tokens[index + 1] if index + 1 < len(tokens) else ""
        in_table_context = previous_token in relation_tokens or token in {"table", "tables"} or next_token in {"table", "tables"}

        if not in_table_context:
            continue

        best_match = max(SequenceMatcher(None, token, table_name).ratio() for table_name in table_name_set)
        if best_match >= 0.5:
            close_matches.append((token, token))

    if close_matches:
        required_names = ", ".join(sorted(set(table_names_lower)))
        details = ", ".join(sorted({token for token, _ in close_matches}))
        return ValidationResult(
            valid=False,
            reason=(
                f"Use exact table names only. Expected one of: {required_names}. "
                f"Close spellings like {details} are blocked."
            ),
            badges=["Exact table names required"],
        )

    return ValidationResult(valid=True, badges=["Exact table names verified"])


def validate_requested_schema_terms(question: str, tables: list[TableInfo]) -> ValidationResult:
    if not tables:
        return ValidationResult(valid=True, badges=["Schema terms skipped"])

    tokens = re.findall(r"[a-z0-9_]+", question.lower())
    table_spellings: set[str] = set()
    column_spellings: set[str] = set()
    column_names: set[str] = set()

    for table in tables:
        table_spellings.update(_singular_plural_variants(table.table_name.lower()))
        for column in table.columns:
            column_name = column.name.lower()
            column_names.add(column_name)
            column_spellings.update(_singular_plural_variants(column_name))
            column_spellings.update(column_name.split("_"))

    allowed = table_spellings | column_spellings | QUESTION_STOPWORDS
    missing: list[str] = []

    for index, token in enumerate(tokens):
        if token.isnumeric() or token in allowed:
            continue

        previous_token = tokens[index - 1] if index > 0 else ""
        likely_requested_field = (
            token.endswith("s")
            or previous_token in {"and", "with", "include", "including", "by", "per", "of", "show", "list", "get"}
        )
        if likely_requested_field:
            missing.append(token)

    if missing:
        unique_missing = sorted(set(missing))
        available_columns = ", ".join(sorted(column_names))
        requested = ", ".join(f"'{item}'" for item in unique_missing)
        verb = "doesn't" if len(unique_missing) == 1 else "don't"
        return ValidationResult(
            valid=False,
            reason=(
                f"Your query asks for {requested}, but {verb} exist as a column in the selected schema. "
                f"Available columns are: {available_columns}."
            ),
            badges=["Schema terms verified"],
        )

    return ValidationResult(valid=True, badges=["Schema terms verified"])


def validate_select_sql(sql: str, row_limit: int) -> ValidationResult:
    normalized = _strip_trailing_semicolon(sql)
    if not normalized:
        return ValidationResult(valid=False, reason="Generated SQL is empty.")

    if "--" in normalized or "/*" in normalized or "*/" in normalized:
        return ValidationResult(valid=False, reason="SQL comments are blocked.")

    if ";" in normalized:
        return ValidationResult(valid=False, reason="Multiple SQL statements are blocked.")

    for pattern, reason in INJECTION_PATTERNS:
        if pattern.search(normalized):
            return ValidationResult(valid=False, reason=reason)

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
