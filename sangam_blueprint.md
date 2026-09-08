# SANGAM — Full Development Blueprint & Phase-Wise Build Prompts
### AI-Powered Block Planning for Indian Railways — SIH26027

**Project name is fixed: SANGAM. Do not rename it at any phase.**

This document is a complete, sequential build guide. Each phase has:
- **Goal** — what this phase achieves
- **Scope** — exact deliverables
- **Prompt** — paste this directly into your AI coding assistant (Claude Code, Cursor, etc.) to build that phase

Build phases **in order**. Do not skip ahead — later phases assume earlier ones exist.

---

## 0. Project Summary (keep this at the top of your repo README)

**SANGAM** is a constraint-optimization platform that ingests maintenance demand from three Indian Railways departments — Engineering, Traction Distribution (TRD), and Signalling (S&T) — plus real train-timetable corridor availability, and produces a jointly-optimized block (line-closure) plan that minimizes total closure hours versus today's siloed, department-by-department scheduling.

- **Core engine:** Google OR-Tools CP-SAT constraint solver (not an LLM — this is a scheduling/optimization problem, not a language problem)
- **Comparison baselines:** independent department scheduler + greedy earliest-window scheduler, so the win is measurable, not asserted
- **UI direction:** light enterprise / government operations interface — think Indian Railways control-office software crossed with a clean modern enterprise dashboard. NOT a dark, neon, "AI startup" aesthetic.
- **Human-in-the-loop:** the optimizer recommends; a controller approves, overrides, or requests a re-plan.

---

## 1. Design System (apply this in every frontend phase)

Lock this in before any UI work starts, so every screen is consistent.

**Visual language:**
- Background: white / very light grey (`#F7F8FA` panels on `#FFFFFF` page background)
- Text: dark navy/charcoal (`#1A2233` primary, `#5B6472` secondary) — never pure black
- Primary accent: one restrained color — deep Indian-Railways blue (`#1E3A8A`–`#1E40AF` range) as the dominant accent; reserve red strictly for critical/alert states, not decoration
- Borders: thin, 1px, light grey (`#E2E5EA`) — not heavy shadows
- Cards: compact, moderate corner radius (6–10px, not pill-shaped), subtle 1px border rather than large drop shadows
- Tables: clear header row (light grey background, medium-weight text), zebra-free, thin row dividers, right-aligned numeric columns
- Status badges: small, pill-shaped, low-saturation fills (e.g., pale red bg + dark red text for "Critical", pale amber for "Overdue", pale green for "On Track") — never solid neon fills
- Icons: simple line icons (Lucide/Feather style), not filled/glossy
- Typography: strong but restrained — one clear heading weight, one body weight, tabular numerals for data columns
- Gradients: essentially none. Flat fills only.
- Motion: minimal — no bouncing/glowing/pulsing elements. Subtle fade/slide on panel transitions only.

**Layout reference (left nav + top KPI strip + content), based on the attached reference images (Everhour timeline bars, Vantus scheduling Gantt, Nestora card layout):**

```
┌───────────┬─────────────────────────────────────────────────────┐
│  SANGAM   │  Overview                          [Week: 07–13 Sep] │
│  ───────  ├─────────────────────────────────────────────────────┤
│  Overview │  ┌────────┬────────┬────────┬────────┐              │
│           │  │ Active │Critical│ Blocks │ Asset   │              │
│  Block    │  │  Maint.│Defects │Planned │Availab. │              │
│  Planning │  │   24   │   8    │   42   │  94.2%  │              │
│  ├ Weekly │  └────────┴────────┴────────┴────────┘              │
│  ├ Monthly│                                                      │
│  └ Gantt  │  ┌────────────────────┐  ┌────────────────────────┐ │
│           │  │ Today's Block Plan │  │ Critical / Overdue      │ │
│  Maint.   │  │ (mini timeline)    │  │ Tasks (list + badges)   │ │
│  ├Pending │  └────────────────────┘  └────────────────────────┘ │
│  ├Critical│                                                      │
│  └Overdue │  ┌────────────────────────────────────────────────┐ │
│           │  │ Weekly Coordinated Block Plan (Gantt, 3 lanes:  │ │
│  Corridor │  │ Engineering / S&T / Traction)                   │ │
│  Availab. │  └────────────────────────────────────────────────┘ │
│           │                                                      │
│  Conflicts│                                                      │
│  & Alerts │                                                      │
│           │                                                      │
│  Depts    │                                                      │
│  ├ Eng    │                                                      │
│  ├ Trac   │                                                      │
│  └ S&T    │                                                      │
│           │                                                      │
│  Reports  │                                                      │
└───────────┴─────────────────────────────────────────────────────┘
```

**Golden rule:** the AI/optimizer is never the visual centerpiece. The user's eye should land on data (tasks, blocks, conflicts) first, and on "AI" framing second. Flow is always:

```
Dashboard → Maintenance/Defects → Priority → Block Optimization → Gantt Plan → Conflicts → Approve
```

---

## 2. Tech Stack (final — do not deviate mid-build)

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + TypeScript + Vite | Fast dev loop, standard SIH-judge-legible stack |
| Styling | Tailwind CSS (core utility classes only) | Matches the enterprise design system, fast to theme |
| Charts/Gantt | Custom SVG/`div`-based timeline components (no heavy chart lib needed for Gantt bars) + Recharts for KPI trend lines only | Full control over the enterprise look; avoids fighting a chart library's default styling |
| Icons | lucide-react | Simple line icons, matches design system |
| Backend | Python + FastAPI | OR-Tools is Python-native; avoids a cross-language bridge |
| Validation | Pydantic v2 | Type-safe request/response models |
| ORM | SQLAlchemy | Standard, everyone can read it |
| Database | PostgreSQL | Relational fit for sections/tasks/plans/runs |
| Optimization | Google OR-Tools CP-SAT (primary) | Best fit for discrete scheduling + conflict constraints |
| Baselines | Plain Python schedulers (independent-department, greedy) | No library needed — deterministic logic |
| Graph | NetworkX | Section-conflict / task-compatibility graph |
| Synthetic data | Python generator script, seeded distributions | Disclosed, reproducible, documented methodology |
| Auth | Skip for MVP (single-role demo login) | Explicitly a "Future" item |
| Deployment | Docker Compose (frontend + backend + Postgres) | Runs on any judge's laptop, no exotic infra |

---

## PHASE 0 — Repository & Environment Setup

### Goal
Get a clean, empty-but-runnable full-stack skeleton with Docker Compose, before any feature code.

### Scope
- Monorepo structure: `/frontend`, `/backend`, `/data`, `/docs`
- FastAPI backend with a single `/health` endpoint
- React + Vite + Tailwind frontend with a blank shell page showing "SANGAM"
- PostgreSQL via Docker Compose
- `.env.example` for both frontend and backend
- README with the Project Summary from Section 0 of this document

### Prompt for Phase 0

```
Set up a monorepo for a project called SANGAM with this exact structure:

/frontend  — React 18 + TypeScript + Vite + Tailwind CSS
/backend   — Python + FastAPI + SQLAlchemy + Pydantic v2
/data      — empty folder for synthetic data generator output
/docs      — empty folder for architecture docs

Requirements:
1. Backend: FastAPI app with a single GET /health endpoint returning {"status": "ok", "service": "SANGAM"}. Include a requirements.txt with fastapi, uvicorn, sqlalchemy, psycopg2-binary, pydantic, python-dotenv, ortools, networkx.
2. Frontend: Vite + React + TypeScript scaffold with Tailwind CSS configured. Create a blank shell layout: a left sidebar (empty nav placeholder) and a top bar showing the text "SANGAM" in a deep navy/blue color (#1E3A8A), on a white background. Do NOT use dark mode, neon colors, or gradients anywhere. Use Inter or system-ui font.
3. docker-compose.yml at repo root with three services: postgres (postgres:16), backend (build from /backend, expose 8000), frontend (build from /frontend, expose 5173 in dev mode). Postgres should use env vars for db name/user/password with sane defaults (sangam_db / sangam_user / sangam_pass).
4. .env.example files in both /frontend and /backend listing the required environment variables (DATABASE_URL for backend, VITE_API_BASE_URL for frontend).
5. A root README.md containing this exact project summary:

"SANGAM is a constraint-optimization platform that ingests maintenance demand from three Indian Railways departments — Engineering, Traction Distribution (TRD), and Signalling (S&T) — plus real train-timetable corridor availability, and produces a jointly-optimized block (line-closure) plan that minimizes total closure hours versus today's siloed, department-by-department scheduling. Core engine: Google OR-Tools CP-SAT. UI direction: light enterprise/government operations interface, not a dark AI-startup aesthetic."

Do not implement any business logic yet — this phase is scaffolding only. Confirm the app builds and `docker compose up` starts all three services successfully.
```

---

## PHASE 1 — Data Model & Database Schema

### Goal
Define the canonical data model every later phase depends on.

### Scope
SQLAlchemy models + Alembic (or simple `create_all`) migration for:
- `railway_sections`
- `assets`
- `maintenance_tasks`
- `train_movements`
- `block_windows`
- `resources`
- `task_resource_requirements`
- `task_conflicts` (compatibility/conflict edges)
- `optimization_runs`
- `generated_blocks`
- `generated_block_tasks`
- `departments` (Engineering / S&T / TRD as fixed seed rows)

### Prompt for Phase 1

```
In the SANGAM backend (/backend), using SQLAlchemy (declarative models) and Pydantic v2 schemas, implement the following data model. Use PostgreSQL-appropriate types (UUID primary keys via uuid4, TIMESTAMP for datetimes, NUMERIC for durations/scores where relevant).

Tables:

1. departments: id, name (Engineering | Traction Distribution | Signalling), code (ENG | TRD | SNT)

2. railway_sections: id, name, from_station, to_station, line_type (single | double), section_capacity_notes (text, nullable)

3. assets: id, asset_type, section_id (FK), department_id (FK), health_state (Good | Degraded | Critical), notes (text, nullable)

4. maintenance_tasks: id, task_code (e.g. ENG-3421), department_id (FK), section_id (FK), asset_id (FK, nullable), maintenance_type, severity (Low | Medium | High | Critical), detected_at, due_date, estimated_duration_min (int), minimum_contiguous_block_min (int), requires_power_isolation (bool), can_run_parallel (bool), status (Pending | Scheduled | Completed | Deferred), priority_score (float, nullable, computed later), created_at

5. train_movements: id, section_id (FK), train_type (Passenger | Goods), entry_time, exit_time, priority (int), forecast_confidence (float, nullable — for goods trains)

6. block_windows: id, section_id (FK), window_start, window_end, block_type (Maintenance | Mega-block), is_available (bool)

7. resources: id, department_id (FK), resource_type (Crew | Equipment), name, is_available (bool)

8. task_resource_requirements: id, task_id (FK), resource_id (FK)

9. task_conflicts: id, task_a_id (FK), task_b_id (FK), relationship (compatible | conflict | dependency), notes (text, nullable)

10. optimization_runs: id, run_type (independent_baseline | greedy_baseline | sangam_optimized), horizon (weekly | monthly), started_at, completed_at, objective_value (float, nullable), status (running | completed | infeasible | failed)

11. generated_blocks: id, run_id (FK), section_id (FK), block_start, block_end, is_joint_block (bool)

12. generated_block_tasks: id, block_id (FK), task_id (FK)

Requirements:
- Add proper FK constraints and indexes on frequently-filtered columns (section_id, department_id, status, due_date).
- Write a seed script (backend/scripts/seed_departments.py) that inserts exactly three departments: Engineering (ENG), Traction Distribution (TRD), Signalling (SNT).
- Write a database init script/entrypoint so `docker compose up` creates all tables automatically on first run.
- Create matching Pydantic schemas (Create/Read variants) for every table, in backend/schemas/.
- Do not build any API endpoints yet — this phase is schema + seed only. Confirm tables are created correctly by running the seed script against the Dockerized Postgres.
```

---

## PHASE 2 — Synthetic Data Generator (disclosed methodology)

### Goal
Generate a realistic, reproducible, clearly-labeled synthetic dataset for one demo corridor — this is the single most judge-scrutinized part of the build, so document it as a first-class artifact.

### Scope
- One fictional corridor: `Station A → B → C → D → E → F` (6 stations, 5 sections) — explicitly non-real to avoid implying operational accuracy
- 100–150 maintenance tasks across Engineering / TRD / S&T, non-uniform severity distribution
- ~60 passenger train movements + ~20 goods movements per week across the 5 sections
- 15 crews / 10 equipment resources
- Compatibility/conflict rules seeded (not random) — e.g., OHE isolation tasks conflict with any task on the same section at the same time unless explicitly compatible
- A written methodology doc explaining every distribution choice, saved to `/docs/synthetic_data_methodology.md`

### Prompt for Phase 2

```
In the SANGAM backend, build a synthetic data generator at backend/scripts/generate_synthetic_data.py that populates the Phase 1 schema for a single fictional demo corridor.

Corridor: 6 stations named Station A through Station F, connected by 5 sections (A-B, B-C, C-D, D-E, E-F). Do NOT use real Indian Railways station names — keep it clearly fictional/prototype-labeled.

Generate:
1. 5 railway_sections rows for the corridor above.
2. 120 maintenance_tasks distributed across Engineering, TRD, and Signalling (roughly 45/35/40 split), with a NON-uniform severity distribution: ~8% Critical, ~22% High, ~40% Medium, ~30% Low (use weighted random choice, not uniform). Durations should vary by maintenance_type using realistic ranges (e.g., "Weld Repair" 60-120 min, "Point Machine Inspection" 30-60 min, "OHE Inspection" 45-90 min) — define a small lookup table of task types per department with a duration range each, and sample from it. due_date should skew tasks toward being due within 1-4 weeks, with a smaller tail overdue already (detected_at before due_date, and for ~10% of tasks the due_date should already be in the past to simulate overdue backlog).
3. 80 train_movements per week across the 5 sections (60 Passenger, 20 Goods), with passenger trains clustered around realistic peak windows (e.g., 06:00-10:00 and 17:00-21:00 denser) and goods trains given a forecast_confidence between 0.6 and 0.95.
4. 15 resources (mix of Crew and Equipment) distributed across the three departments.
5. task_resource_requirements linking each task to 1-3 resources appropriate to its department.
6. task_conflicts: encode conflict/compatible/dependency relationships using RULES, not randomness:
   - Any two tasks on the same section with overlapping requires_power_isolation=True → conflict
   - Tasks on the same section, same department, compatible duration, and can_run_parallel=True on both → compatible
   - Otherwise leave unlinked (no row) unless it's an explicit precedence case (~5% of tasks should have a dependency relationship to another task)

After generating, write /docs/synthetic_data_methodology.md documenting:
- Every distribution and range used above, and why (e.g., "severity uses an 8/22/40/30 weighted split to avoid an unrealistically dense critical backlog, loosely informed by typical maintenance-backlog shape described in RDSO-style inspection cycles — this is a modeling choice, not a sourced statistic, and is disclosed as such")
- An explicit "This dataset is entirely synthetic. The only real data used elsewhere in SANGAM is the corridor-availability logic derived from train_movements timing structure, which mimics but does not reproduce any real published timetable." disclosure statement, verbatim, at the top of the file.

Make the generator idempotent (clears and re-seeds rather than duplicating on re-run) and runnable via `python backend/scripts/generate_synthetic_data.py` inside the Docker container.
```

---

## PHASE 3 — Corridor Availability Engine

### Goal
Convert train_movements into candidate block (closure) windows per section.

### Scope
- Function: given a section + date range, compute gaps between train movements (respecting a minimum buffer/headway before and after each train) → list of candidate windows
- Populate `block_windows` table from this logic
- Window Risk Score calculation (train density, freight uncertainty, peak-hour penalty)

### Prompt for Phase 3

```
In the SANGAM backend, implement a Corridor Availability Engine in backend/services/corridor_availability.py.

Function 1: compute_candidate_windows(section_id, date_range, min_buffer_minutes=10)
- Fetch all train_movements for the section within the date range, sorted by entry_time.
- Compute gaps between consecutive train movements (and between day-start/day-end and the first/last train), subtracting min_buffer_minutes from each side of every gap as a safety buffer.
- Discard gaps shorter than 20 minutes (too short to be a usable block).
- Return a list of candidate windows: {section_id, window_start, window_end, duration_min}.

Function 2: compute_window_risk_score(window, section_id)
- WindowRisk = TrainDensity + FreightUncertainty + PeakHourPenalty + DelayPropagationRisk
- TrainDensity: number of train movements in the same section within +/- 2 hours of the window, normalized 0-1
- FreightUncertainty: average (1 - forecast_confidence) of nearby goods movements, 0 if none nearby
- PeakHourPenalty: +0.3 if window overlaps 06:00-10:00 or 17:00-21:00, else 0
- DelayPropagationRisk: +0.2 if window is directly adjacent (within 15 min) to a passenger train movement, else 0
- Return a float risk score (lower = better/safer window).

Function 3: populate_block_windows(section_ids, date_range)
- For each section, call compute_candidate_windows, then compute_window_risk_score for each, and upsert rows into the block_windows table (block_type='Maintenance', is_available=True), storing the risk score in a new nullable risk_score column you add to the block_windows model (update the Phase 1 model + migration).

Add a FastAPI endpoint:
GET /api/corridor/{section_id}/windows?start_date=...&end_date=...
returning the candidate windows with their risk scores, sorted by risk_score ascending.

Write a short unit test (pytest) that verifies compute_candidate_windows correctly finds gaps for a small hand-constructed set of train movements (e.g., 3 trains with known gaps), asserting the returned window count and durations match expectations.
```

---

## PHASE 4 — Priority Scoring Engine

### Goal
Score every maintenance task so the optimizer knows what matters most.

### Scope
- Weighted priority formula (transparent, not a black-box ML model, per the blueprint's explainability requirement)
- Configurable weights (stored in a config table or JSON, not hardcoded magic numbers)
- Populate `maintenance_tasks.priority_score`

### Prompt for Phase 4

```
In the SANGAM backend, implement a Priority Scoring Engine in backend/services/priority_engine.py.

Use this transparent weighted formula (NOT a trained ML model — must be fully explainable):

Priority_i = w1*Criticality + w2*OverdueSeverity + w3*SafetyConsequence + w4*AssetImportance + w5*FailureRisk

Default weights (store these in a JSON config file backend/config/priority_weights.json, loaded at runtime, so they're adjustable without code changes):
{
  "criticality": 0.30,
  "overdue_severity": 0.25,
  "safety_consequence": 0.20,
  "asset_importance": 0.15,
  "failure_risk": 0.10
}

Feature computation (each normalized to 0-1):
- criticality: map severity Low=0.25, Medium=0.5, High=0.75, Critical=1.0
- overdue_severity: max(0, (today - due_date).days) / 30, capped at 1.0 (0 if not yet due)
- safety_consequence: 1.0 if requires_power_isolation else 0.4 if severity in (High, Critical) else 0.2
- asset_importance: 1.0 if asset.health_state == 'Critical', 0.6 if 'Degraded', 0.3 if 'Good'
- failure_risk: for the prototype, use a simple deterministic proxy since there is no historical failure dataset — failure_risk = criticality * overdue_severity (documented explicitly as a placeholder heuristic, NOT a trained model, until real historical data exists)

Function: compute_priority_score(task) -> float (0-100 scale, multiply the weighted 0-1 sum by 100)

Function: recompute_all_priority_scores() -> updates maintenance_tasks.priority_score for every task in the DB.

Add a FastAPI endpoint:
POST /api/tasks/recompute-priority — triggers recompute_all_priority_scores and returns a count of updated tasks.
GET /api/tasks?department=&severity=&min_priority=&overdue_only=bool — returns tasks with filters, sorted by priority_score descending by default.

Also add a GET /api/tasks/{task_id}/priority-breakdown endpoint that returns the individual weighted components (criticality contribution, overdue contribution, etc.) as a dict — this powers the "Why this priority?" explainability panel in a later frontend phase. This must return real computed numbers, not placeholder text.
```

---

## PHASE 5 — Task Compatibility & Conflict Graph

### Goal
Build the graph that tells the optimizer which tasks can safely share a block.

### Scope
- NetworkX graph builder from `task_conflicts` table + rule-based inference
- Query functions: get compatible task clusters for a section, check if two tasks conflict

### Prompt for Phase 5

```
In the SANGAM backend, implement the Compatibility & Conflict Graph in backend/services/compatibility_graph.py using NetworkX.

Function: build_section_graph(section_id, date_range) -> networkx.Graph
- Nodes: all maintenance_tasks for that section with status='Pending' whose due_date falls in or before the date range's end.
- Edges: read from task_conflicts table (relationship = 'compatible' or 'conflict' or 'dependency'), plus apply these inference rules for any task PAIR not already explicitly listed:
  - If both tasks have requires_power_isolation=True and are on the same section → edge type 'conflict' (cannot share a block)
  - If both tasks have can_run_parallel=True and same department and combined duration fits a reasonable single block (<=180 min) → edge type 'compatible'
  - Otherwise no edge (unknown/neutral — optimizer treats as "not explicitly compatible, so schedule separately unless proven safe")

Function: get_compatible_clusters(graph) -> list of task-id sets
- Use networkx to find cliques or connected components restricted to 'compatible' edges only (ignore 'conflict' and 'dependency' edges for this specific function) — these are candidate joint-block groupings for the optimizer to consider.

Function: has_conflict(graph, task_id_a, task_id_b) -> bool
- Returns True if there's a 'conflict' edge between them (used as a hard constraint check later in Phase 6).

Function: get_dependencies(graph, task_id) -> list of task_ids that must complete before this one (from 'dependency' edges).

Add a FastAPI endpoint:
GET /api/sections/{section_id}/compatibility-graph?start_date=&end_date=
returning nodes (task summaries) and edges (task_a_id, task_b_id, relationship) in a JSON shape ready for a frontend graph visualization (id/label per node, source/target/type per edge).

Write a pytest test with a small hand-built set of 5 tasks and known conflict/compatible relationships, asserting get_compatible_clusters and has_conflict return correct results.
```

---

## PHASE 6 — Optimization Engine (CP-SAT) + Baseline Schedulers

### Goal
This is the technical heart of SANGAM. Build the constraint solver and the two honest baselines it will be compared against.

### Scope
- CP-SAT model: decision variables, hard constraints, weighted objective
- Baseline 1: independent department scheduler
- Baseline 2: greedy earliest-window scheduler
- All three write results to `optimization_runs` / `generated_blocks` / `generated_block_tasks`

### Prompt for Phase 6

```
In the SANGAM backend, implement the core optimization engine in backend/services/optimizer.py using Google OR-Tools CP-SAT, plus two baseline schedulers in backend/services/baselines.py.

=== SHARED INPUT PREP ===
Function: prepare_optimization_input(section_ids, date_range) -> a dataclass/dict bundling:
- tasks: pending maintenance_tasks in scope, each with priority_score (from Phase 4), duration, minimum_contiguous_block_min, requires_power_isolation, department_id, section_id
- windows: candidate block_windows in scope (from Phase 3), each with risk_score
- compatibility graph (from Phase 5)
- resources and task_resource_requirements

=== BASELINE 1: Independent Department Scheduler (backend/services/baselines.py) ===
Function: run_independent_baseline(input_bundle) -> plan
- For EACH department separately: sort its tasks by priority_score descending, greedily assign each task to the earliest available window on its section that fits the duration and doesn't violate resource double-booking WITHIN that department only (no cross-department awareness — this is the point, it simulates today's siloed process).
- Each department "opens" its own block even if another department already has an open block on the same section at an overlapping time — this deliberately reproduces the redundant-closure problem.
- Save result as an optimization_runs row (run_type='independent_baseline') + generated_blocks + generated_block_tasks.

=== BASELINE 2: Greedy Earliest-Window Scheduler ===
Function: run_greedy_baseline(input_bundle) -> plan
- Pool ALL tasks (all departments together), sort by priority_score descending.
- For each task, assign it to the earliest available window that fits, and if a compatible task (per the compatibility graph) is already assigned to an overlapping window on the same section, join it into that same block (simple greedy joint-block opportunism, not fully optimized).
- Save as optimization_runs row (run_type='greedy_baseline').

=== PRIMARY: CP-SAT Optimizer ===
Function: run_sangam_optimizer(input_bundle, time_limit_seconds=30) -> plan

Decision variables:
- x[i,j] = BoolVar, task i assigned to window j
- y[j] = BoolVar, window j is opened as an active block
- unscheduled[i] = BoolVar, task i deferred (not scheduled this horizon)

Hard constraints:
1. Each task assigned to at most one window OR marked unscheduled: sum(x[i,j] for all j) + unscheduled[i] == 1
2. A task can only be assigned to a window on its own section.
3. Window capacity: sum of task durations assigned to window j <= window j's duration, only if y[j] == 1.
4. If x[i,j] == 1 then y[j] must be 1 (link constraint).
5. Conflict constraint: for any two tasks with a 'conflict' edge (from Phase 5), they cannot both be assigned to the same window j.
6. Task duration must fit: only allow x[i,j]==1 if task i's minimum_contiguous_block_min <= window j's duration.
7. Dependency constraint: if task A must precede task B (from Phase 5 dependency edges), task A's window must end at or before task B's window starts (compare window_start/window_end of assigned windows — implement via reified constraints on which window index was chosen, or precompute only valid (A-window, B-window) pairs that satisfy ordering).
8. Resource non-overlap: for any resource shared by two tasks assigned to overlapping-time windows on different sections, they cannot both be scheduled (a crew/equipment cannot be in two places at once) — model via a resource-usage-interval no-overlap constraint (use CP-SAT's AddNoOverlap on intervals per resource).

Objective (minimize):
```
1000 * sum(unscheduled[i] * priority_score[i] for critical/high severity tasks)
+ 100 * sum(unscheduled[i] * priority_score[i] for all other tasks)
+ 20  * sum(y[j] * window_risk_score[j] for all j)   # train-impact proxy
+ 10  * sum(y[j] * window_duration[j] for all j)     # total block minutes (downtime)
- 15  * sum over compatible task pairs jointly assigned to the same window  # reward joint blocks
```
(Document these exact coefficients in code comments as "calibrated defaults for the prototype, not universal railway constants" — matching the blueprint's own caution against presenting them as authoritative.)

Solve with solver.parameters.max_time_in_seconds = time_limit_seconds. Handle three outcomes explicitly:
- OPTIMAL or FEASIBLE → build the plan, save to generated_blocks/generated_block_tasks, save optimization_runs with status='completed' and objective_value = solver.ObjectiveValue()
- INFEASIBLE → save optimization_runs with status='infeasible', return a clear error explaining infeasibility was detected and NO plan was forced (never silently drop this)
- Otherwise (timeout without solution) → status='failed', return diagnostic info

=== API ENDPOINTS ===
POST /api/plans/generate
Body: { "section_ids": [...], "start_date": "...", "end_date": "...", "horizon": "weekly"|"monthly", "run_types": ["independent_baseline","greedy_baseline","sangam_optimized"] }
- Runs the requested scheduler(s) in sequence, returns run_ids and a summary (objective_value, total_block_minutes, tasks_scheduled, tasks_unscheduled) for each.

GET /api/plans/{run_id}
- Returns the full generated plan: list of blocks with their assigned tasks, section, start/end time, is_joint_block flag.

GET /api/plans/compare?run_ids=id1,id2,id3
- Returns a side-by-side KPI table across the requested runs: total_block_hours, critical_tasks_completed_pct, joint_blocks_count, unscheduled_priority_sum, train_impact_score (sum of window risk scores used).

Write a pytest integration test using a small synthetic scenario (5-10 tasks, 3-4 windows, at least one known conflict pair and one known compatible pair) asserting:
- the optimizer never co-schedules the known conflict pair
- the optimizer DOES co-schedule the known compatible pair when it's beneficial
- total_block_minutes for sangam_optimized <= independent_baseline on this scenario
```

---

## PHASE 7 — KPI & Explainability Engine

### Goal
Turn raw plan output into the numbers and reasoning judges/controllers actually look at.

### Scope
- KPI computation service (shared by all three run types)
- Per-task "Why this priority / why this window" explanation generator

### Prompt for Phase 7

```
In the SANGAM backend, implement backend/services/kpi_engine.py and backend/services/explainability.py.

=== KPI ENGINE ===
Function: compute_kpis(run_id) -> dict
- total_block_hours: sum of all generated_blocks durations for this run, in hours
- critical_task_coverage_pct: (critical/high severity tasks scheduled) / (total critical/high severity tasks in scope) * 100
- joint_block_utilization_pct: (blocks with is_joint_block=True) / (total blocks) * 100
- unscheduled_priority_sum: sum of priority_score for all tasks marked unscheduled in this run
- train_impact_score: sum of window risk_score for every opened block
- resource_utilization_pct: (resource-minutes used) / (resource-minutes available in horizon) * 100

Function: compute_downtime_saved(baseline_run_id, optimized_run_id) -> dict
- Returns { "baseline_hours": X, "optimized_hours": Y, "hours_saved": X-Y, "percent_saved": ((X-Y)/X)*100 }

API endpoint: GET /api/plans/{run_id}/kpis — returns compute_kpis output.
API endpoint: GET /api/plans/compare-downtime?baseline_run_id=&optimized_run_id= — returns compute_downtime_saved output.

=== EXPLAINABILITY ENGINE ===
Function: explain_task_priority(task_id) -> dict
- Reuses Phase 4's compute_priority_score breakdown, formats as human-readable reasons, e.g.:
  { "score": 91, "reasons": [
      {"factor": "Criticality", "contribution": 25, "detail": "Severity: Critical"},
      {"factor": "Overdue severity", "contribution": 14, "detail": "5 days overdue"},
      ... ] }

Function: explain_task_scheduling(run_id, task_id) -> dict
- For the given run, find which block/window the task was assigned to (or if unscheduled), and generate reasons:
  If scheduled: { "scheduled": true, "window": {...}, "reasons": ["Lowest corridor occupancy window on this section", "Sufficient contiguous duration (110 min available, 90 min required)", "Compatible with task <task_code> in same block", "No hard safety conflict"] }
  If unscheduled: { "scheduled": false, "reasons": ["No compatible window met the minimum contiguous block requirement without violating a resource conflict", "Deferred in favor of N higher-priority tasks on the same section"] }
- These reason strings should be generated from the ACTUAL constraint state (which windows were tried/rejected and why), not hardcoded — pull from the window's risk_score, duration comparison, and any detected conflict/resource clash for that specific task and run.

API endpoint: GET /api/plans/{run_id}/tasks/{task_id}/explanation — returns explain_task_scheduling, merged with explain_task_priority.

This phase has no frontend work — confirm all endpoints return correct, real (not placeholder) data by testing against Phase 6's output for at least one full optimizer run.
```

---

## PHASE 8 — Frontend Foundation (Shell, Nav, Design System Components)

### Goal
Build the reusable UI shell and component library every screen will use, matching Section 1's design system.

### Scope
- Left nav (matches the Section 1 nav tree)
- Top bar with corridor/week selector
- Reusable components: KPI stat card, status badge, data table, panel/card container, button variants
- API client setup (typed fetch wrapper pointing at the FastAPI backend)

### Prompt for Phase 8

```
In the SANGAM frontend (/frontend), build the application shell and a reusable component library, strictly following this design system:

Colors (define as Tailwind theme extensions in tailwind.config):
- background: #FFFFFF (page), #F7F8FA (panel/card backgrounds)
- text-primary: #1A2233
- text-secondary: #5B6472
- accent: #1E3A8A (primary blue — buttons, active nav, links)
- accent-hover: #1E40AF
- border: #E2E5EA
- status-critical-bg: #FDECEC / status-critical-text: #B42318
- status-warning-bg: #FEF3E2 / status-warning-text: #B54708
- status-good-bg: #E7F6EC / status-good-text: #067647
- status-neutral-bg: #EEF1F5 / status-neutral-text: #475467

Rules: no gradients, no drop-shadow beyond a very subtle 1px border-based elevation, corner radius 6-10px on cards (not pill-shaped except badges), thin 1px borders (#E2E5EA) as the primary separation technique instead of heavy shadows.

Build:

1. AppShell component: left sidebar (fixed width ~240px, white bg, right border) + main content area (light grey bg #F7F8FA with white content cards on top). Sidebar contains the SANGAM wordmark at top (deep blue text, no logo image needed — just clean typography) and this nav tree, using lucide-react icons (simple line icons):
   - Overview (home icon)
   - Block Planning (calendar icon) — expandable: Weekly Plan, Monthly Plan, Gantt View
   - Maintenance (wrench icon) — expandable: Pending Tasks, Critical Defects, Overdue Work
   - Corridor Availability (map icon)
   - Conflicts & Alerts (alert-triangle icon)
   - Departments (building icon) — expandable: Engineering, Traction, S&T
   - Reports (bar-chart icon)
   Active nav item: accent-colored text + light accent-tinted background, left border accent stripe.

2. TopBar component: shows current page title on the left, and a compact "Week: 07–13 Sep" style date-range selector + corridor/section dropdown on the right, in a thin bordered pill, not a heavy dropdown button.

3. Reusable components in /frontend/src/components/ui/:
   - KpiStatCard: label (small, text-secondary) + big number (text-primary, bold, tabular-nums) + optional trend indicator. Compact padding, 1px border, white bg.
   - StatusBadge: props for variant ('critical'|'warning'|'good'|'neutral') and label, renders as a small pill using the status colors above.
   - DataTable: generic typed table component (header row bg #F7F8FA, medium-weight header text, 1px row dividers, right-align numeric columns via a column config prop, hover row highlight subtle).
   - Panel: a card container (white bg, border, rounded-lg, padding) used to wrap every content block.
   - Button: primary (solid accent bg, white text), secondary (white bg, border, text-primary), and ghost variants, all with 6-8px radius, no gradients.

4. API client: /frontend/src/lib/apiClient.ts — a typed fetch wrapper reading VITE_API_BASE_URL from env, with methods matching the backend endpoints built so far (health check at minimum; add typed functions as stubs for tasks, plans, kpis endpoints to be filled in during later phases).

Build a blank Overview page at this point that only shows the AppShell + TopBar + four empty KpiStatCard placeholders in a row, to confirm the shell renders correctly. No real data wiring yet — that's Phase 9.
```

---

## PHASE 9 — Overview / Dashboard Screen

### Goal
Wire the real Overview screen: KPI strip, today's mini block plan, critical/overdue task list.

### Scope
- Live data from `/api/tasks`, `/api/plans/{run_id}/kpis` (using the latest completed run), `/api/tasks?overdue_only=true`

### Prompt for Phase 9

```
In the SANGAM frontend, build the real Overview page at /frontend/src/pages/Overview.tsx, replacing the Phase 8 placeholder, using the AppShell/TopBar/KpiStatCard/Panel/StatusBadge/DataTable components already built.

Layout (top to bottom):

1. KPI strip: 4 KpiStatCard components in a row:
   - "Active Maintenance" — count of tasks with status='Pending'
   - "Critical Defects" — count of tasks with severity in ('Critical','High') and status='Pending'
   - "Blocks Planned" — count of generated_blocks for the most recent completed sangam_optimized run
   - "Asset Availability" — compute as (1 - total_block_hours / total_available_hours_in_horizon) * 100, formatted as a percentage; if this figure isn't yet computable from existing endpoints, add a small backend helper endpoint GET /api/kpis/asset-availability?run_id= that returns it.

2. Two-column row:
   - Left Panel "Today's Block Plan": a compact mini-timeline (simple horizontal bars, one row per department: Engineering / S&T / Traction Distribution) showing today's date's blocks from the latest sangam_optimized run. Build this as a lightweight custom component (div-based bars positioned by percentage-of-day, not a heavy chart library), matching the visual reference of stacked colored horizontal bars against a time axis.
   - Right Panel "Critical / Overdue Tasks": a DataTable listing tasks where severity is Critical/High OR overdue, columns: Task Code, Department, Section, Due Date, StatusBadge (Critical/Overdue/Warning based on severity+due date), limited to top 8 by priority_score, with a "View all" link to the Maintenance > Critical Defects page (route can be a stub for now).

3. Full-width Panel "Weekly Coordinated Block Plan": a 3-lane Gantt-style timeline (one lane per department, spanning the current week Mon-Sun on the x-axis) showing blocks from the latest sangam_optimized run as horizontal bars positioned/sized by their start/end time, colored by department (use three distinct muted accent colors, not neon), with joint blocks (is_joint_block=true) visually marked (e.g., a small icon or a subtle diagonal-stripe pattern) so it's obvious at a glance which blocks combine multiple departments' work.

All data must come from real backend calls via the apiClient (extend it with typed functions for GET /api/tasks, GET /api/plans/{run_id}, GET /api/plans/{run_id}/kpis, and the new asset-availability endpoint). Handle loading and empty states cleanly (skeleton or simple "Loading..." text — keep it minimal, no elaborate spinners). If no optimizer run exists yet, show a clear empty-state panel prompting the user to go generate a plan, with a Button linking to the Block Planning page.
```

---

## PHASE 10 — Maintenance Backlog Screens

### Goal
Pending / Critical / Overdue task list views with filters.

### Prompt for Phase 10

```
In the SANGAM frontend, build three pages under /frontend/src/pages/maintenance/:
- PendingTasks.tsx (all status='Pending' tasks)
- CriticalDefects.tsx (severity in Critical/High)
- OverdueWork.tsx (due_date < today)

All three share a common MaintenanceTaskTable component (build once, reuse across all three with different filter props) using the DataTable component from Phase 8, with columns: Task Code, Department (as a small colored tag, not a full badge), Section, Maintenance Type, Severity (StatusBadge), Due Date, Priority Score (right-aligned, tabular-nums, bold if >75), Status.

Add a filter bar above the table (Panel-wrapped): Department dropdown (All/Engineering/TRD/S&T), Section dropdown, a "min priority score" slider or number input, all wired to query params on GET /api/tasks (extend the apiClient function from Phase 9 to accept these filter params matching the backend's existing query params from Phase 4).

Row click behavior: clicking a row opens a right-side slide-over panel (not a full page navigation) showing:
- Task details (all fields)
- The priority breakdown from GET /api/tasks/{task_id}/priority-breakdown (Phase 4), rendered as a small horizontal stacked bar or simple list showing each factor's contribution — this is the "Why this priority?" panel described in the blueprint.

Keep the slide-over visually consistent with the design system: white bg, left border, subtle shadow only on this specific overlay element (this is the one place a slightly stronger shadow is acceptable, since it's a genuine overlay).

Wire up the left nav items (Maintenance > Pending Tasks / Critical Defects / Overdue Work) from Phase 8 to route to these three pages using React Router (add react-router-dom if not already present, set up routes in App.tsx).
```

---

## PHASE 11 — Block Planning: Weekly / Monthly / Gantt Views + Plan Generation

### Goal
The core interactive feature: let a user trigger optimization and see the resulting plan.

### Scope
- "Generate Plan" flow (horizon selector, corridor/section selector, run all three schedulers)
- Weekly plan view (day-by-day block list)
- Monthly plan view (rollup)
- Full Gantt view (bigger version of the Overview's mini Gantt, interactive)

### Prompt for Phase 11

```
In the SANGAM frontend, build the Block Planning section under /frontend/src/pages/planning/:

1. PlanGenerator.tsx (a panel usable at the top of Weekly/Monthly/Gantt pages, or its own sub-page):
   - Controls: Horizon toggle (Weekly | Monthly), Section multi-select (from GET /api/sections — add this simple list endpoint to the backend if not present), date range picker defaulting to the current week/month.
   - A primary Button "Generate Plan" that calls POST /api/plans/generate with run_types: ["independent_baseline","greedy_baseline","sangam_optimized"].
   - While running, show a simple ordered status list (not a flashy animation, matching the enterprise tone): "Validating constraints… / Scoring maintenance… / Finding candidate windows… / Building compatibility graph… / Optimizing…" — these can just be timed UI states while awaiting the API response, or better, if you add lightweight status polling to the backend (optimization_runs.status), poll it every 1s and reflect real status.
   - On completion, store the three resulting run_ids in page/app state and navigate to WeeklyPlan.tsx (or MonthlyPlan.tsx based on horizon chosen).

2. WeeklyPlan.tsx:
   - Day-by-day list (Mon-Sun), each day expandable, showing blocks scheduled that day: time range, section, department(s) involved (as small tags), joint-block indicator, list of task codes in that block.
   - Data from GET /api/plans/{run_id} where run_id is the sangam_optimized run from the last generation.
   - Include a small toggle to switch which run's plan is being viewed (Independent Baseline / Greedy / SANGAM Optimized) so a user can flip between them and see the difference directly in this list view.

3. MonthlyPlan.tsx:
   - Rollup view: one row per week within the month, showing aggregate block-hours per department (small bar per department per week, or a compact table), plus a count of high-risk corridors (sections with the most critical/overdue tasks). This does not need per-block detail — it's a capacity-planning view per the blueprint's monthly-mode definition.

4. GanttView.tsx:
   - A larger, full-page version of the Overview's mini-Gantt (Phase 9), spanning the selected date range, 3 lanes by department, with zoom (day/week toggle) if reasonable to implement, and click-to-expand on a block to show its task list in a small popover (task codes, priority scores, is_joint_block).
   - Reuse the same custom bar-timeline component built in Phase 9 rather than rebuilding it — extract it into a shared component if not already.

Wire the left nav's Block Planning > Weekly Plan / Monthly Plan / Gantt View items to these three routes, and make PlanGenerator accessible from all three (e.g., as a collapsible panel at the top of each page) so the user doesn't have to leave the page to regenerate a plan.
```

---

## PHASE 12 — Comparison View (Before vs After — the "winning slide")

### Goal
This is explicitly called out in both source documents as the single most important screen for judging. Build it with disproportionate care.

### Scope
- Side-by-side KPI comparison table across all three run types
- A visual "three separate closures collapsing into one shared window" moment for the demo

### Prompt for Phase 12

```
In the SANGAM frontend, build /frontend/src/pages/planning/PlanComparison.tsx — this is the most important screen in the entire product for demo purposes, so build it carefully.

Layout:

1. Top: a KPI comparison table (3 columns: Independent Baseline | Greedy Baseline | SANGAM Optimized), rows: Total Block Hours, Critical Task Coverage %, Joint Block Utilization %, Unscheduled Priority Sum, Train Impact Score. Data from GET /api/plans/compare?run_ids=... (Phase 6). Highlight the SANGAM Optimized column with a subtle accent-tinted background (not a loud color) and put a small "Best" or checkmark indicator next to the best value in each row.

2. Below that, a prominent headline stat panel: "X hours of closure time saved this week" computed from GET /api/plans/compare-downtime (Phase 7), shown in large, bold, accent-colored text (this is the one place a slightly larger/bolder treatment than the rest of the design system is justified, since it's the single number the whole pitch rests on) — but keep it in the same color palette, no neon, no gradient.

3. The core visual: a "before vs after" mini-Gantt pair for ONE example section (auto-pick the section with the most joint-block opportunity in the current plan, or let the user pick from a dropdown):
   - Left: "Independent Scheduling (Today)" — show that section's blocks from the independent_baseline run as 3 separate lanes/bars (one per department) at their (likely non-overlapping, redundant) times.
   - Right: "SANGAM Optimized" — the same section's blocks from the sangam_optimized run, showing the same work now collapsed into fewer, shared windows.
   - Use identical time-axis scaling on both sides so the visual reduction in total colored area is immediately obvious side-by-side.
   - This should be built as two instances of the same Gantt bar component from Phase 9/11, just fed different run_ids and section-filtered data — do not build a separate one-off component.

4. A small disclosure footer strip (text-secondary, small text, always visible on this page): "Maintenance demand shown is synthetic, generated from disclosed distributions (see /docs/synthetic_data_methodology.md). Corridor timing structure mimics realistic timetable patterns for this prototype." — this directly implements the blueprint's "transparent disclosure of what's synthetic vs. real" requirement and should never be omitted from this screen.

Wire this page to the left nav under Reports, and also link to it directly from the Block Planning pages (e.g., a "Compare to baseline" button on WeeklyPlan.tsx once a plan has been generated).
```

---

## PHASE 13 — Conflicts & Alerts + Corridor Availability Screens

### Goal
Surface infeasibilities, conflicts, and raw corridor-window data transparently.

### Prompt for Phase 13

```
In the SANGAM frontend, build two more pages:

1. /frontend/src/pages/ConflictsAlerts.tsx:
   - List any tasks marked unscheduled in the latest sangam_optimized run, using GET /api/plans/{run_id}/tasks/{task_id}/explanation (Phase 7) for each to show the reason, in a DataTable: Task Code, Department, Priority Score, Reason (from the explanation's reasons list, joined as short text), with a StatusBadge "Deferred".
   - If the latest run's status is 'infeasible', show a prominent warning Panel (status-warning colors, not critical-red, since infeasibility being correctly reported is a feature not a failure) explaining that the solver could not find a feasible plan under current constraints, with a "View details" expandable section if you choose to surface any solver diagnostic text.
   - Also list any task_conflicts rows with relationship='conflict' that are relevant to the current planning horizon, as a reference table, so a controller can see the underlying safety rules being enforced.

2. /frontend/src/pages/CorridorAvailability.tsx:
   - Section selector + date range, showing raw candidate block_windows from GET /api/corridor/{section_id}/windows (Phase 3) in a DataTable: Window Start, Window End, Duration (min), Risk Score, with a subtle color scale on Risk Score (low=good-tinted text, high=warning-tinted text) rather than a badge (this is dense reference data, not a status list).

Add both to the left nav (Conflicts & Alerts, Corridor Availability) with working routes. Keep both screens data-dense and table-forward per the design system — this is reference/audit information, not a marketing screen, so avoid large decorative elements here.
```

---

## PHASE 14 — What-If Simulation & Re-Planning

### Goal
Let a controller test a scenario change and see recomputed KPIs, and simulate a disruption triggering minimal-change re-planning.

### Scope
- Simple what-if: mark a window unavailable or a task as newly critical, re-run the optimizer scoped to the affected section, show before/after KPI delta
- Disruption simulation: simulate a train delay shifting a window, show which blocks are invalidated and the re-plan

### Prompt for Phase 14

```
Backend additions (backend/services/replanning.py):

Function: simulate_disruption(run_id, section_id, disruption_type='train_delay', delay_minutes=45)
- Find blocks in the given run for that section that would now overlap with the shifted train movement (extend one train_movement's entry_time/exit_time by delay_minutes for this simulation only, not persisted).
- Identify affected generated_blocks (those whose window now conflicts with the shifted movement).
- Re-run a SCOPED CP-SAT solve: freeze/lock all blocks NOT affected (add them as fixed assignments/constraints), only re-optimize the affected tasks against remaining valid windows in that section, adding a plan-instability penalty term (small cost) for changing any task's originally-assigned window, so the solver prefers minimal change.
- Save as a new optimization_runs row (run_type='sangam_optimized', with a note/field indicating it's a re-plan derived from the original run_id — add a parent_run_id nullable FK column to optimization_runs).
- Return a diff: { "affected_blocks": [...], "new_assignments": [...], "unchanged_count": N, "changed_count": M }

API endpoint: POST /api/plans/{run_id}/simulate-disruption — body: { section_id, delay_minutes }, returns the diff above.

Function: whatif_kpi_delta(run_id, changes) where changes can mark a specific block_window as unavailable or bump a task's severity — recompute KPIs for a scoped re-solve and return { current_kpis, scenario_kpis, deltas }.
API endpoint: POST /api/plans/{run_id}/whatif — body describing the change, returns the KPI delta above.

Frontend (/frontend/src/pages/planning/ReplanningCenter.tsx):
- A panel to trigger "Simulate Train Delay" with a section selector and a delay-minutes input, calling the disruption endpoint, then displaying:
  - A small "before" mini-Gantt (original blocks for that section) and "after" mini-Gantt (re-planned), reusing the shared Gantt bar component again.
  - A short plain-language summary generated from the diff data (e.g., "Train delayed 45 min. 1 block shifted from 01:00–02:30 to 01:42–03:12. 2 lower-priority tasks moved to the next available window. 0 critical tasks affected.") — construct this sentence from the real diff/explanation data, not a hardcoded string.

Frontend what-if: a simple form (lock a block / mark a window unavailable / raise a task's severity) with a "Run Scenario" button calling the whatif endpoint, displaying current_kpis vs scenario_kpis as a small two-column comparison (reuse the KPI comparison table pattern from Phase 12).

Add "Replanning Center" as a page reachable from Block Planning (e.g., a tab or button on WeeklyPlan.tsx), not necessarily its own top-level nav item, to keep the nav tree from Section 1 unchanged.
```

---

## PHASE 15 — Polish, Demo Data Freeze, and Deployment

### Goal
Final pass: make sure the demo path is bulletproof, deploy via Docker Compose, and prepare the fixed demo dataset/script.

### Scope
- Freeze a specific "golden" synthetic dataset + a specific known-good scenario for the live demo
- End-to-end smoke test script
- Docker Compose production-ish build (single command to run everything)
- A `/docs/demo_script.md` mirroring the 2–3 minute flow from the blueprint

### Prompt for Phase 15

```
Final polish pass on SANGAM:

1. Backend: add a script backend/scripts/freeze_demo_dataset.py that runs the Phase 2 generator with a FIXED random seed (e.g., seed=26027) so the exact same synthetic dataset is produced every time — this must be the dataset used in the actual demo, so it's reproducible if anything needs restarting.

2. Backend: add backend/scripts/smoke_test.py that, against a freshly seeded DB, in order: (a) recomputes priority scores, (b) populates block windows for all 5 demo sections for the current week, (c) runs all three schedulers (independent, greedy, sangam_optimized) via the /api/plans/generate logic directly (not over HTTP, call the service functions), (d) asserts sangam_optimized's total_block_hours is less than independent_baseline's, (e) asserts no conflict pair is ever co-scheduled in the sangam_optimized result, (f) prints a clean pass/fail summary. This is the pre-demo sanity check.

3. Frontend: do a full pass over every page built in Phases 8-14 checking:
   - No dark-mode/neon/gradient elements crept in anywhere (audit against Section 1 design tokens)
   - Every loading state and empty state has a clean, minimal treatment (no default browser "undefined" or broken layouts if a list is empty)
   - The left nav's active-page highlighting works correctly on every route

4. docker-compose.yml final version: ensure `docker compose up --build` from a clean clone results in: Postgres up → backend auto-creates tables + can run the seed/freeze scripts via a documented `docker compose exec backend python scripts/freeze_demo_dataset.py` → frontend served and able to reach the backend via VITE_API_BASE_URL. Document these exact commands in the root README under a "Demo Setup" section.

5. Write /docs/demo_script.md containing this exact flow (adapt only the specific numbers to whatever the frozen dataset actually produces once run):

Minute 0-1: Problem — Open Overview, point out the three department task counts and today's mini block plan showing separate, uncoordinated closures for the same section.
Minute 1-2: Data — Open Maintenance > Pending Tasks, filter by section, show the same section has Engineering/S&T/TRD tasks all due around the same time.
Minute 2-3: Generate — Go to Block Planning, click Generate Plan for that section/week, narrate the real status steps as they appear.
Minute 3-4: Explain — Open the Gantt view, click a joint block, show the task list and open the "Why this plan?" explanation panel for one task.
Minute 4-5: Prove it — Open Plan Comparison, show the KPI table and the headline "X hours saved" figure, and the before/after mini-Gantt pair.
Minute 5-6: Disruption — Open Replanning Center, simulate a train delay, show the minimal-change re-plan and its plain-language summary.
Closing line: "SANGAM doesn't ask departments to coordinate better — it makes coordination a solved problem, and it's the only submission in the room that can show the number for it."

This is the final phase. After this, SANGAM should be demo-ready end to end.
```

---

## Appendix A — Judge Q&A Cheat Sheet (keep handy during demo, not part of the app)

| Question | Answer |
|---|---|
| Where's the AI? | The intelligence is in the optimization formulation — multi-department co-location as a joint constraint-satisfaction problem, solved with CP-SAT. Priority scoring is a transparent weighted formula by design, not a black-box model, because railway safety decisions need to be explainable. |
| Why not an LLM/chatbot? | This is a well-defined combinatorial scheduling problem with a numeric objective. An LLM wrapper would add opacity without adding value — we say this proactively. |
| Is your data real? | The passenger/goods timetable *structure* mimics realistic patterns; the maintenance backlog is fully synthetic, generated from disclosed, documented distributions (see `/docs/synthetic_data_methodology.md`), because TMS/SMMS/TDMS internal systems aren't publicly accessible. |
| How do you prove it's better? | We run the same demand through three schedulers — independent-department (today's process), greedy, and SANGAM's CP-SAT optimizer — and report the actual computed downtime-hours-saved number, not an estimate. |
| What if the AI is wrong? | Every plan requires human review; controllers can lock, override, or reject any assignment, and the optimizer re-solves around their decisions. Hard safety constraints (conflicts, resource double-booking) can never be violated by the solver regardless of the objective. |
| Does this scale? | Architecturally yes — more corridors means more graph nodes and windows; the honest bottleneck is solver runtime, which we manage via time limits, section-level decomposition, and rolling horizons rather than one giant monthly solve. |

---

## Appendix B — File/Folder Reference (what should exist by the end of Phase 15)

```
/frontend
  /src
    /pages
      Overview.tsx
      /maintenance
        PendingTasks.tsx
        CriticalDefects.tsx
        OverdueWork.tsx
      /planning
        PlanGenerator.tsx
        WeeklyPlan.tsx
        MonthlyPlan.tsx
        GanttView.tsx
        PlanComparison.tsx
        ReplanningCenter.tsx
      ConflictsAlerts.tsx
      CorridorAvailability.tsx
    /components
      AppShell.tsx
      TopBar.tsx
      /ui
        KpiStatCard.tsx
        StatusBadge.tsx
        DataTable.tsx
        Panel.tsx
        Button.tsx
      GanttBars.tsx   (shared timeline component)
    /lib
      apiClient.ts

/backend
  /models        (SQLAlchemy models, Phase 1)
  /schemas       (Pydantic schemas, Phase 1)
  /services
    corridor_availability.py
    priority_engine.py
    compatibility_graph.py
    optimizer.py
    baselines.py
    kpi_engine.py
    explainability.py
    replanning.py
  /scripts
    seed_departments.py
    generate_synthetic_data.py
    freeze_demo_dataset.py
    smoke_test.py
  /config
    priority_weights.json
  main.py         (FastAPI app + route registration)

/docs
  synthetic_data_methodology.md
  demo_script.md

docker-compose.yml
README.md
```

---

**End of blueprint. Project name SANGAM is fixed and must not change in any phase's output.**
