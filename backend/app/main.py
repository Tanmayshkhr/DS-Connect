# pip install fastapi uvicorn motor pydantic pydantic-settings python-jose[cryptography] passlib[bcrypt] fastapi-mail python-multipart email-validator
# Run: python -m uvicorn app.main:app --reload --port 8000

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth

app = FastAPI(title="DS Connect API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)


@app.get("/api/health")
async def health_check() -> dict[str, str]:
    return {"status": "operational", "message": "API is running."}
