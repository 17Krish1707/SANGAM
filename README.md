# SANGAM — AI-Powered Block Planning for Indian Railways
### Problem Statement: SIH26027

SANGAM is a constraint-optimization platform that ingests maintenance demand from three Indian Railways departments — Engineering, Traction Distribution (TRD), and Signalling (S&T) — plus real train-timetable corridor availability, and produces a jointly-optimized block (line-closure) plan that minimizes total closure hours versus today's siloed, department-by-department scheduling. Core engine: Google OR-Tools CP-SAT. UI direction: light enterprise/government operations interface, not a dark AI-startup aesthetic.

---

## Architecture Overview

- **Core Engine:** Google OR-Tools CP-SAT constraint satisfaction & optimization solver.
- **Comparison Baselines:**
  - Independent department scheduler (siloed scheduling)
  - Greedy earliest-window scheduler (pooled earliest fit)
  - SANGAM Joint Optimizer (joint block coordination)
- **Backend:** Python + FastAPI + SQLAlchemy + Pydantic v2
- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS (Light Enterprise Operations Design System)
- **Database:** PostgreSQL (with Docker Compose support)

---

## Directory Structure

```
.
├── backend/          # FastAPI API, OR-Tools CP-SAT, and DB models
├── frontend/         # React 18 + Vite + Tailwind CSS dashboard
├── data/             # Synthetic datasets and exports
├── docs/             # Architecture docs, methodology & scripts
└── docker-compose.yml# Containerized setup for local & evaluation deployment
```

---

## Quick Start

### Running with Docker Compose
```bash
docker compose up --build
```
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000`
- API Docs: `http://localhost:8000/docs`
- Health Check: `http://localhost:8000/health`

### Local Development

#### Backend
```bash
cd backend
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

#### Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## Demo Setup

After `docker compose up --build` (or local setup), run these commands in order:

```bash
# 1. Freeze the reproducible demo dataset (seed=26027)
docker compose exec backend python backend/scripts/freeze_demo_dataset.py

# 2. Run the pre-demo smoke test
docker compose exec backend python backend/scripts/smoke_test.py
```

For local (non-Docker) setup:
```bash
# From the project root:
python backend/scripts/freeze_demo_dataset.py
python backend/scripts/smoke_test.py
```

The smoke test validates:
- Priority scores are computed for all tasks
- Corridor block windows are populated for all 5 demo sections
- All three schedulers (Independent, Greedy, SANGAM CP-SAT) produce valid plans
- SANGAM optimized total block hours < Independent baseline
- No conflict pairs are co-scheduled in the optimized result

Once all checks pass, open `http://localhost:5173` and follow `/docs/demo_script.md` for the live demo walkthrough.

---

## Running Tests

```bash
python -m pytest tests/ -v
```

