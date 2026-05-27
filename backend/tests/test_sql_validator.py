from app.models import ColumnInfo, TableInfo
from app.sql_validator import validate_exact_table_mentions, validate_requested_schema_terms, validate_select_sql


def _schema():
    return [
        TableInfo(
            schema_name="public",
            table_name="customers",
            columns=[
                ColumnInfo(name="id", data_type="bigint", is_nullable=False),
                ColumnInfo(name="name", data_type="text", is_nullable=True),
                ColumnInfo(name="revenue", data_type="double precision", is_nullable=True),
            ],
        ),
        TableInfo(
            schema_name="public",
            table_name="orders",
            columns=[
                ColumnInfo(name="id", data_type="bigint", is_nullable=False),
                ColumnInfo(name="customer_id", data_type="bigint", is_nullable=True),
                ColumnInfo(name="amount", data_type="bigint", is_nullable=True),
                ColumnInfo(name="order_date", data_type="text", is_nullable=True),
            ],
        ),
    ]


def test_safe_select_passes_and_is_wrapped():
    result = validate_select_sql("SELECT id, name FROM customers", 100)

    assert result.valid is True
    assert result.executable_sql == "SELECT * FROM (SELECT id, name FROM customers) AS chatbot_safe_query LIMIT 100"
    assert "SELECT only" in result.badges


def test_blocks_dangerous_keywords():
    result = validate_select_sql("DROP TABLE customers", 100)

    assert result.valid is False
    assert "Only SELECT" in result.reason


def test_blocks_dml_inside_cte():
    result = validate_select_sql("WITH deleted AS (DELETE FROM orders RETURNING *) SELECT * FROM deleted", 100)

    assert result.valid is False
    assert "DELETE" in result.reason


def test_blocks_multiple_statements():
    result = validate_select_sql("SELECT * FROM customers; SELECT * FROM orders", 100)

    assert result.valid is False
    assert "Multiple" in result.reason


def test_blocks_comments():
    result = validate_select_sql("SELECT * FROM customers -- trick", 100)

    assert result.valid is False
    assert "comments" in result.reason


def test_blocks_union_based_injection():
    result = validate_select_sql("SELECT id FROM customers UNION SELECT password FROM users", 100)

    assert result.valid is False
    assert "UNION" in result.reason


def test_blocks_tautology_based_injection():
    result = validate_select_sql("SELECT * FROM customers WHERE name = 'x' OR 1=1", 100)

    assert result.valid is False
    assert "tautology" in result.reason.lower()


def test_blocks_time_delay_injection():
    result = validate_select_sql("SELECT * FROM customers WHERE id = 1 OR pg_sleep(5) IS NULL", 100)

    assert result.valid is False
    assert "delay" in result.reason.lower()


def test_blocks_abbreviated_table_mentions():
    result = validate_exact_table_mentions("Count of orders by cust", ["customers", "orders"])

    assert result.valid is False
    assert "exact table names" in result.reason.lower()


def test_allows_exact_table_mentions():
    result = validate_exact_table_mentions("Count of orders by customers", ["customers", "orders"])

    assert result.valid is True


def test_allows_singular_table_mentions():
    result = validate_exact_table_mentions("Show each customer with recent order totals", ["customers", "orders"])

    assert result.valid is True


def test_blocks_close_misspellings():
    result = validate_exact_table_mentions("Count of orers by custmers", ["orders", "customers"])

    assert result.valid is False
    assert "close spellings" in result.reason.lower()


def test_blocks_requested_missing_column_plural():
    result = validate_requested_schema_terms("Show orders with customers names and emails", _schema())

    assert result.valid is False
    assert "'emails'" in result.reason
    assert "available columns" in result.reason.lower()


def test_allows_requested_column_plural_when_singular_column_exists():
    result = validate_requested_schema_terms("Show orders with customer names", _schema())

    assert result.valid is True


def test_schema_term_validation_is_dynamic_for_future_columns():
    tables = [
        TableInfo(
            schema_name="public",
            table_name="employees",
            columns=[
                ColumnInfo(name="id", data_type="bigint", is_nullable=False),
                ColumnInfo(name="email", data_type="text", is_nullable=True),
            ],
        )
    ]

    result = validate_requested_schema_terms("Show employees emails", tables)

    assert result.valid is True
