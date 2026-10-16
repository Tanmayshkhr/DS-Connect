# pip install fastapi uvicorn motor pydantic pydantic-settings python-jose[cryptography] passlib[bcrypt] fastapi-mail python-multipart email-validator
# Run: python -m uvicorn app.main:app --reload --port 8000

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import analytics, audit_logs, auth, departments, faqs, tickets, users

app = FastAPI(title="DS Connect API")

# Both 5173 and 5174 are listed because Vite silently bumps the port when
# 5173 is already occupied — without 5174 here the preflight returns 400.
_DEFAULT_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
]
ALLOWED_ORIGINS: list[str] = [
    o.strip()
    for o in os.getenv("ALLOWED_ORIGINS", ",".join(_DEFAULT_ORIGINS)).split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(tickets.router)
app.include_router(faqs.router)
app.include_router(departments.router)
app.include_router(analytics.router)
app.include_router(audit_logs.router)


@app.get("/api/health")
async def health_check() -> dict[str, str]:
    return {"status": "operational", "message": "API is running."}
