from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    groq_api_key: str = Field(default="", alias="GROQ_API_KEY")
    groq_model: str = Field(default="llama-3.3-70b-versatile", alias="GROQ_MODEL")
    database_url: str = Field(default="", alias="DATABASE_URL")
    supabase_database_url: str = Field(default="", alias="SUPABASE_DATABASE_URL")
    query_row_limit: int = Field(default=1000, alias="QUERY_ROW_LIMIT")
    query_timeout_seconds: int = Field(default=15, alias="QUERY_TIMEOUT_SECONDS")
    frontend_origin: str = Field(default="http://127.0.0.1:5176", alias="FRONTEND_ORIGIN")
    allowed_schemas: str = Field(default="public", alias="ALLOWED_SCHEMAS")

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    def require_groq(self) -> None:
        if not self.groq_api_key:
            raise RuntimeError("GROQ_API_KEY is missing. Add it to backend/.env.")

    def require_database(self) -> None:
        if not self.active_database_url:
            raise RuntimeError("SUPABASE_DATABASE_URL or DATABASE_URL is missing. Add it to backend/.env.")

    @property
    def active_database_url(self) -> str:
        return self.supabase_database_url or self.database_url

    @property
    def schema_allowlist(self) -> list[str]:
        return [schema.strip() for schema in self.allowed_schemas.split(",") if schema.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
