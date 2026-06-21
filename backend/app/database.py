from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.config import settings

client = AsyncIOMotorClient(settings.MONGO_URI)
db: AsyncIOMotorDatabase = client["ds_connect"]


def get_db() -> AsyncIOMotorDatabase:
    return db
