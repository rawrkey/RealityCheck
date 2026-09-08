"""Application configuration loaded from environment / .env."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration for the RealityCheck backend."""

    port: int = 8000
    cors_origins: str = "http://localhost:5173"

    assemblyai_api_key: str | None = None
    assemblyai_base_url: str = "https://api.assemblyai.com"
    assemblyai_llm_model: str = "gemini-2.5-flash-lite"
    assemblyai_llm_base_url: str = "https://llm-gateway.assemblyai.com/v1"
    assemblyai_llm_max_tokens: int = 6000

    voice_agent_base_url: str = "https://agents.assemblyai.com"
    voice_agent_ws_url: str = "wss://agents.assemblyai.com/v1/ws"
    voice_agent_token_ttl_seconds: int = 300

    call_storage_dir: str = "data/demo/calls"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def cors_origin_list(self) -> list[str]:
        """Return the comma-separated origins as a list."""
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()