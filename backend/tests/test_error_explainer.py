from app.error_explainer import explain_sql_error_locally
from app.models import ColumnInfo, TableInfo


def _tables():
    return [
        TableInfo(
            schema_name="public",
            table_name="customers",
            columns=[
                ColumnInfo(name="id", data_type="bigint", is_nullable=False),
                ColumnInfo(name="revenue", data_type="double precision", is_nullable=True),
            ],
        ),
        TableInfo(
            schema_name="public",
            table_name="orders",
            columns=[
                ColumnInfo(name="id", data_type="bigint", is_nullable=False),
                ColumnInfo(name="amount", data_type="bigint", is_nullable=True),
            ],
        ),
    ]


def test_explains_missing_column_with_suggestion():
    explanation = explain_sql_error_locally('column "revenu" does not exist', _tables())

    assert explanation == "Your query failed because column 'revenu' doesn't exist. You might have meant 'revenue'."


def test_explains_qualified_missing_column():
    explanation = explain_sql_error_locally("column c.email does not exist", _tables())

    assert explanation == "Your query failed because column 'email' doesn't exist in the selected database schema."


def test_explains_missing_table_with_suggestion():
    explanation = explain_sql_error_locally('relation "customer" does not exist', _tables())

    assert explanation == "Your query failed because table 'customer' doesn't exist. You might have meant 'customers'."
