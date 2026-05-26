from app.sql_validator import validate_select_sql


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
