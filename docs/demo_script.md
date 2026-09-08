# SANGAM — Live Demo Script (5–6 Minutes)

> **Seed:** 26027 (fixed, reproducible). Run `python backend/scripts/freeze_demo_dataset.py` before the demo to ensure consistent data.

---

## Minute 0–1: The Problem

1. Open **Overview** (the default landing page).
2. Point out the four KPI cards at the top:
   - **Active Maintenance** — ~120 pending tasks across three departments.
   - **Critical Defects** — note the number of Critical/High severity items needing urgent attention.
   - **Blocks Planned** — from the latest optimized run.
   - **Asset Availability** — corridor uptime percentage.
3. Scroll down to **Today's Block Plan** — the mini-timeline shows three separate lanes (Engineering, TRD, S&T) with independent, uncoordinated closures on the same section.
4. *Narration:* "Today, three departments each request their own line closures independently. The same track section may be closed three separate times in a single day for work that could have been done in one coordinated window."

---

## Minute 1–2: The Data

1. Navigate to **Maintenance → Pending Tasks** in the left sidebar.
2. Use the **Section** dropdown to filter by a single section (e.g., "Section A-B").
3. Point out that Engineering, S&T, and TRD all have tasks due on the same section around the same dates.
4. Click on a **Critical** task row to open the **Priority Breakdown** slide-over panel:
   - Show the weighted factor breakdown: Criticality, Overdue Severity, Safety Consequence, Asset Importance, Failure Risk.
   - *Narration:* "Every priority score is transparent and explainable — no black box."

---

## Minute 2–3: Generate the Plan

1. Navigate to **Block Planning → Weekly Plan**.
2. The **Plan Generator** panel is at the top. Select the current week and all sections.
3. Click **Generate Plan**.
4. Watch the real-time status progression:
   - "Validating constraints…"
   - "Scoring maintenance tasks…"
   - "Finding candidate windows…"
   - "Building compatibility graph…"
   - "Optimizing with CP-SAT…"
5. On completion, the page auto-loads the optimized weekly plan showing day-by-day blocks.

---

## Minute 3–4: Explain the Plan

1. Switch to **Block Planning → Gantt View**.
2. The three-lane Gantt chart shows Engineering, TRD, and S&T blocks across the week.
3. Click on a **joint block** (marked with a special indicator) to expand:
   - Show the list of tasks from multiple departments sharing one closure window.
4. Open the **"Why this plan?"** explanation for a specific task:
   - "Lowest corridor occupancy window on this section"
   - "Sufficient contiguous duration (110 min available, 90 min required)"
   - "Compatible with task ENG-3421 in same block"
   - "No hard safety conflict"
5. *Narration:* "Every scheduling decision is explainable — controllers can see exactly why each task was placed in each window."

---

## Minute 4–5: Prove It

1. Navigate to **Reports** (Plan Comparison) — the "winning slide."
2. **KPI Comparison Table** shows three columns:
   | Metric | Independent | Greedy | SANGAM |
   |--------|------------|--------|---------|
   | Total Block Hours | Higher | Medium | **Lowest** ✓ |
   | Critical Task Coverage | Lower | Medium | **Highest** ✓ |
   | Joint Block Utilization | 0% | Some | **Highest** ✓ |
3. **Headline stat:** "X hours of closure time saved this week" — the single number the pitch rests on.
4. **Before/After mini-Gantt pair:** Select a section with the most joint-block opportunity.
   - Left: Independent scheduling — three separate bars for the same section.
   - Right: SANGAM optimized — same work consolidated into fewer shared windows.
   - *The visual reduction in colored area is immediately obvious.*
5. *Narration:* "We don't assert improvement — we measure it. Same demand, same constraints, same corridor. The only variable is the scheduling algorithm."

---

## Minute 5–6: Disruption Response

1. Navigate to **Block Planning → Weekly Plan**, click the **Replanning Center** button.
2. Select a section and set **Delay: 45 minutes**.
3. Click **Simulate Train Delay**.
4. View the result:
   - **Before** mini-Gantt: original block positions.
   - **After** mini-Gantt: minimally adjusted positions.
   - **Plain-language summary:** "Train delayed 45 min. 1 block shifted from 01:00–02:30 to 01:42–03:12. 2 lower-priority tasks moved to the next available window. 0 critical tasks affected."
5. *Narration:* "Real railways face disruptions every day. SANGAM doesn't just plan — it re-plans, with minimal change, preserving stability."

---

## Closing Line

> **"SANGAM doesn't ask departments to coordinate better — it makes coordination a solved problem, and it's the only submission in the room that can show the number for it."**

---

## Disclosure (always visible on the Comparison page)

> Maintenance demand shown is synthetic, generated from disclosed distributions (see `/docs/synthetic_data_methodology.md`). Corridor timing structure mimics realistic timetable patterns for this prototype.
