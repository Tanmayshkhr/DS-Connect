# pip install fastapi uvicorn motor pydantic pydantic-settings python-jose[cryptography] passlib[bcrypt] fastapi-mail python-multipart email-validator
# Run: python -m uvicorn app.main:app --reload --port 8000

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import analytics, auth, departments, faqs, tickets, users

app = FastAPI(title="DS Connect API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
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


@app.get("/api/health")
async def health_check() -> dict[str, str]:
    return {"status": "operational", "message": "API is running."}
