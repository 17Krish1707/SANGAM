# SANGAM — Synthetic Data Methodology & Disclosure

> **Disclosure Statement:**  
> "This dataset is entirely synthetic. The only real data used elsewhere in SANGAM is the corridor-availability logic derived from train_movements timing structure, which mimics but does not reproduce any real published timetable."

---

## 1. Overview & Purpose

To evaluate the **SANGAM** constraint optimization engine objectively, this prototype utilizes an openly disclosed, fully reproducible synthetic dataset representing an operational railway corridor. 

Internal Indian Railways systems (such as TMS - Track Management System, SMMS - Signalling Maintenance Management System, and TDMS - Traction Distribution Management System) are proprietary and not publicly accessible. Therefore, this methodology establishes a mathematically disciplined proxy that faithfully mirrors the operational dynamics, technical constraints, and departmental workflows of Indian Railways without disclosing confidential network telemetry.

All data is generated deterministically using a fixed random seed (`seed=26027`).

---

## 2. Corridor Topology

| Station | Connected Section | Line Configuration | Operational Profile |
|---|---|---|---|
| **Station A** | Section A-B | Double Line | Trunk entry; 130 km/h design speed |
| **Station B** | Section B-C | Double Line | Intermediate block section with freight loop lines |
| **Station C** | Section C-D | Double Line | Major bridge approach with permanent speed restriction (PSR) |
| **Station D** | Section D-E | Double Line | Curvature & gradient segment; heavy freight axle load |
| **Station E** | Section E-F | Double Line | Multi-track convergence; dense junction interlocking approach |
| **Station F** | *(Terminal)* | Double Line | Destination junction |

*Design rationale:* Six generic stations (Station A through Station F) and five connecting sections are deliberately labeled with neutral alphabetic names to prevent any false implication that the dataset reflects real-world operational safety logs or actual divisional timetable filings.

---

## 3. Maintenance Backlog & Task Distribution

A total of **120 maintenance tasks** are distributed across the three core departments:
- **Engineering (Civil / Track):** 45 tasks (37.5%)
- **Traction Distribution (TRD / Electrical):** 35 tasks (29.2%)
- **Signalling & Telecommunication (S&T):** 40 tasks (33.3%)

### 3.1 Severity Distribution (Non-Uniform Weighted Split)
- **Critical (8%):** Immediate intervention required; potential speed restriction or derailment hazard.
- **High (22%):** Significant degradation; required within near-term inspection cycle.
- **Medium (40%):** Standard scheduled preventive maintenance.
- **Low (30%):** Routine cosmetic, tightening, or non-disruptive inspection.

*Methodology justification:* In real railway maintenance backlogs (e.g. RDSO track inspection cycles), backlogs are heavily skewed towards Medium and Low defects, with Critical defects forming a narrow tail. A uniform distribution would create an unrealistically dense crisis state, distorting solver benchmark results.

### 3.2 Task Catalog & Duration Ranges

| Dept | Maintenance Type | Duration Range | Power Isolation Prob. | Parallelism Prob. |
|---|---|---|---|---|
| **ENG** | Weld Repair & Ultrasonic Testing | 60 – 120 min | 10% | 60% |
| **ENG** | Track Tamping & Packing | 90 – 180 min | 40% | 30% |
| **ENG** | Rail Joint De-stressing | 75 – 150 min | 20% | 40% |
| **ENG** | Turnout & Crossings Overhaul | 120 – 240 min | 30% | 20% |
| **ENG** | Ballast Screening & Cleaning | 150 – 240 min | 20% | 20% |
| **TRD** | OHE Routine Inspection & Stagger Adjustment | 45 – 90 min | 90% | 70% |
| **TRD** | Contact Wire Tensioning & Replacement | 90 – 180 min | 100% | 30% |
| **TRD** | Isolator & Sectioning Switch Servicing | 60 – 120 min | 95% | 50% |
| **TRD** | Cantilever Assembly Overhaul | 75 – 150 min | 100% | 40% |
| **TRD** | Neutral Section & Insulator Washing | 45 – 90 min | 85% | 60% |
| **S&T** | Point Machine Inspection & Testing | 30 – 60 min | 5% | 70% |
| **S&T** | Track Circuit & Axle Counter Calibration | 45 – 90 min | 5% | 80% |
| **S&T** | Signal Aspect Bulb & LED Replacement | 30 – 60 min | 0% | 80% |
| **S&T** | Electronic Interlocking Diagnostic Overhaul | 60 – 120 min | 0% | 50% |
| **S&T** | Cables & Relay Rack Maintenance | 60 – 120 min | 0% | 60% |

- **Minimum Contiguous Block Requirement:** Sampled between 70% and 85% of total estimated duration (minimum 30 minutes), modeling setup and track clearance time.
- **Overdue Backlog:** Exactly 10% of tasks have `due_date` values in the past (1 to 10 days overdue) to simulate real division maintenance deficits. The remaining 90% are scheduled 1 to 28 days in the future.

---

## 4. Timetable & Train Movements

The weekly horizon simulates **80 train movements** across the 5 sections:
- **Passenger Trains (60 movements, 75%):**
  - Priority = 1 (Highest line clearance priority).
  - Forecast confidence = 1.0 (Fixed published schedule).
  - Diurnal clustering: 70% of passenger traffic is concentrated within morning (06:00–10:00) and evening (17:00–21:00) peak corridors.
- **Goods / Freight Trains (20 movements, 25%):**
  - Priority = 2.
  - Forecast confidence = sampled uniformly between 0.60 and 0.95 (reflecting realistic freight path scheduling uncertainty).
  - Skewed towards non-peak mid-day windows (11:00–16:00) and overnight hours (22:00–05:00).

---

## 5. Departmental Resources

A pool of **15 specialized resources** is modeled across the 3 departments:

1. **Engineering (5):**
   - 2 Maintenance Gang Crews (`Crew`)
   - 1 Heavy Tamping Machine 01 (`Equipment`)
   - 1 USFD Flaw Detector Trolley (`Equipment`)
   - 1 Rail Grinder Mobile Unit (`Equipment`)

2. **Traction Distribution (5):**
   - 2 OHE Tower Wagon Crews (`Crew`)
   - 1 Tower Wagon Inspection Car TW-101 (`Equipment`)
   - 1 Emergency Power Breakdown Squad (`Crew`)
   - 1 High-Voltage Grounding Trolley (`Equipment`)

3. **Signalling & Telecommunication (5):**
   - 2 Signal Inspection Teams (`Crew`)
   - 1 Telecom & Interlocking Specialist Unit (`Crew`)
   - 1 Electronic Interlocking Diagnostic Rig (`Equipment`)
   - 1 Point Machine Testing Apparatus (`Equipment`)

*Constraint enforcement:* Each maintenance task links to 1–3 departmental resources. The optimizer enforces non-overlap constraints: a crew or high-value machine cannot be double-booked across different sections simultaneously.

---

## 6. Safety Conflicts, Compatibility & Dependency Rules

Relationships between tasks are governed by strict operational rules rather than random assignment:

1. **Safety Conflict Edge (`conflict`):**
   - If two tasks on the same section both require high-voltage traction power isolation (`requires_power_isolation == True`), they conflict. Simultaneous heavy overhead electrical work or conflicting grounding setups pose severe electrocution and track safety risks.
2. **Joint-Block Compatibility Edge (`compatible`):**
   - If two tasks are on the same section, belong to the same department, both have `can_run_parallel == True`, and their combined duration does not exceed a reasonable block span (180 minutes), they are marked compatible for co-scheduling.
3. **Precedence Dependency Edge (`dependency`):**
   - Approximately 5% of tasks possess hard ordering constraints (e.g. preliminary inspection must precede overhaul, or ballast screening must precede track alignment).

---

## 7. Execution & Idempotency

The dataset can be generated at any time via:
```bash
python backend/scripts/generate_synthetic_data.py [optional_seed]
```
The generator wipes prior demo tables cleanly and re-seeds with deterministic accuracy, ensuring that all subsequent engine phases (Corridor Availability, Priority Scoring, CP-SAT Optimization, and UI Gantt charts) render identical, reproducible figures.
