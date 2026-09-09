import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from contextlib import asynccontextmanager
from backend.database import init_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    if os.environ.get("SANGAM_DATA_MODE") == "demo":
        from backend.database import SessionLocal
        from backend.models.task import MaintenanceTask
        db = SessionLocal()
        try:
            if db.query(MaintenanceTask).count() == 0:
                from backend.scripts.seed_judge_demo import seed_judge_demo
                print("SANGAM_DATA_MODE=demo detected and database is empty. Auto-seeding judge demo...")
                seed_judge_demo()
        finally:
            db.close()
    yield

# Auto-migrate / ensure tables and columns on module load
init_db()

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


from backend.routers import corridor, tasks, sections, plans, kpis, resources, rules
from backend.routers.conflicts import router as conflicts_router

app.include_router(corridor.router)
app.include_router(tasks.router)
app.include_router(sections.router)
app.include_router(plans.router)
app.include_router(kpis.router)
app.include_router(conflicts_router)
app.include_router(resources.router)
app.include_router(rules.router)


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "SANGAM"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
