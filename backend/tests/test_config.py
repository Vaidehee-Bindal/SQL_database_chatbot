import pytest

from app.config import Settings


def test_missing_groq_key_fails_clearly():
    settings = Settings(GROQ_API_KEY="", DATABASE_URL="postgresql://example")

    with pytest.raises(RuntimeError, match="GROQ_API_KEY"):
        settings.require_groq()


def test_missing_database_url_fails_clearly():
    settings = Settings(GROQ_API_KEY="key", DATABASE_URL="", SUPABASE_DATABASE_URL="")

    with pytest.raises(RuntimeError, match="SUPABASE_DATABASE_URL"):
        settings.require_database()


def test_supabase_database_url_is_preferred():
    settings = Settings(
        GROQ_API_KEY="key",
        DATABASE_URL="postgresql://local",
        SUPABASE_DATABASE_URL="postgresql://supabase",
    )

    assert settings.active_database_url == "postgresql://supabase"


def test_schema_allowlist_defaults_to_public():
    settings = Settings(GROQ_API_KEY="key", SUPABASE_DATABASE_URL="postgresql://supabase")

    assert settings.schema_allowlist == ["public"]
