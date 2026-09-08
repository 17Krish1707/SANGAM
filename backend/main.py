import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from contextlib import asynccontextmanager
from backend.database import init_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Auto-create tables on startup
    init_db()
    yield

app = FastAPI(
    title="SANGAM API",
    description="AI-Powered Joint Block Planning for Indian Railways",
    version="0.1.0",
    lifespan=lifespan,
)

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


from backend.routers import corridor, tasks, sections, plans, kpis
from backend.routers.conflicts import router as conflicts_router

app.include_router(corridor.router)
app.include_router(tasks.router)
app.include_router(sections.router)
app.include_router(plans.router)
app.include_router(kpis.router)
app.include_router(conflicts_router)


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "SANGAM"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
