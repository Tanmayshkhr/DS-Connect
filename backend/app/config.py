from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
    )

    MAIL_USERNAME: str
    MAIL_PASSWORD: str
    MAIL_FROM: str
    MONGO_URI: str = "mongodb://localhost:27017"
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    @field_validator("MAIL_PASSWORD")
    @classmethod
    def strip_mail_password_spaces(cls, value: str) -> str:
        return value.replace(" ", "")


settings = Settings()
