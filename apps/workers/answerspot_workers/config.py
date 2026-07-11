from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str
    celery_broker_url: str
    celery_result_backend: str
    openai_api_key: str = ""
    perplexity_api_key: str = ""
    gemini_api_key: str = ""
    serp_api_key: str = ""
    scan_sample_count: int = 3
    scan_monthly_budget_usd: float = 500.0
    sentry_dsn: str = ""

settings = Settings()
