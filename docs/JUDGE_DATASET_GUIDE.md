# SANGAM SIH Judge Demonstration Dataset Guide
**Problem Statement SIH26027 — Coordinated Joint Corridor Block Planning for Indian Railways**

---

## 1. Corridor Sections (3 Active Sections)
The judge demonstration corridor models a high-density double-line broad-gauge trunk route with 25 kV AC OHE traction and Absolute Block signalling between four stations: `Station A → Station B → Station C → Station D`.

| Section Name | Endpoints | Length | Track Structure | Electrification | Operational Role |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Section A-B** | Station A → Station B | 25.0 km | Double Line | 25 kV AC OHE | Feeder trunk segment |
| **Section B-C** | Station B → Station C | 25.0 km | Double Line | 25 kV AC OHE | High-density core junction (Primary Demo Focus) |
| **Section C-D** | Station C → Station D | 25.0 km | Double Line | 25 kV AC OHE | Outbound Absolute Block division |

*Note: Unused downstream sections (D-E, E-F) are purged in Judge Demo Mode to eliminate visual clutter.*

---

## 2. Deterministic Train Movements (09 Sep 2026)
Scheduled train movements are seeded on Wednesday, **09 Sep 2026** (inside the weekly planning horizon):

### Section B-C
1. **P101 (Passenger)**: `00:00 – 00:30` (Priority 1, Overnight Superfast Express) `[Demo Focus]`
2. **P102 (Passenger)**: `04:00 – 04:30` (Priority 1, Morning Intercity Express) `[Demo Focus]`
3. **G201 (Goods)**: `07:00 – 07:40` (Priority 2, Container Freight Rake)
4. **P103 (Passenger)**: `10:00 – 10:30` (Priority 1, Day Express)

### Section A-B
5. **P201 (Passenger)**: `01:00 – 01:30` (Priority 1, Regional Express)
6. **P202 (Passenger)**: `05:00 – 05:30` (Priority 1, Commuter Shuttle)

### Section C-D
7. **P301 (Passenger)**: `02:00 – 02:30` (Priority 1, Night Mail Express)
8. **P302 (Passenger)**: `06:00 – 06:30` (Priority 1, Morning Passenger)

---

## 3. Physical Resource Inventory (8 Resources)
8 physical crew and machinery units across Engineering, Signalling, and Traction:

| Department | Resource Name | Type | Availability | Operational Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Engineering (ENG)** | `ENG Crew 1` | Crew | **Available** | Permanent Way gang for rail welding & inspection |
| **Engineering (ENG)** | `Track Tamper 1` | Equipment | **Available** | Heavy on-track tamping machine |
| **Signalling (SNT)** | `S&T Crew 1` | Crew | **Available** | Signal inspectors & maintainers |
| **Signalling (SNT)** | `Signal Testing Kit 1` | Equipment | **Available** | Interlocking calibration & track circuit tester |
| **Traction (TRD)** | `TRD Crew 1` | Crew | **Available** | High-voltage overhead line crew |
| **Traction (TRD)** | `Tower Wagon 1` | Equipment | **Available** | Self-propelled OHE inspection unit `[Demo Focus]` |
| **Traction (TRD)** | `OHE Isolation Team 1`| Crew | **Available** | Grounding discharge rod placement crew |
| **Traction (TRD)** | `Tower Wagon 2` | Equipment | **UNAVAILABLE** | Periodic Overhaul at workshop (08-Sep to 12-Sep) |

---

## 4. Maintenance Demand (11 Diverse Tasks)

| Task Code | Dept | Section | Work Description | Sev | Dur (Min) | Min Block | Power Iso | Parallel | Resources | Due Date | Demo Role |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **ENG-001** | ENG | B-C | Rail Weld Repair | High | 90 | 75 | No | Yes | `ENG Crew 1` | 10 Sep 2026 | `[Demo Focus]` Core Joint Cluster |
| **SNT-001** | SNT | B-C | Point Machine Inspection | Med | 45 | 30 | No | Yes | `S&T Crew 1` | 11 Sep 2026 | `[Demo Focus]` Core Joint Cluster |
| **TRD-001** | TRD | B-C | OHE Inspection | High | 60 | 45 | Yes | Yes | `TRD Crew 1`, `Tower Wagon 1` | 10 Sep 2026 | `[Demo Focus]` Core Joint Cluster |
| **ENG-002** | ENG | A-B | Track Geometry Inspection | Med | 60 | 45 | No | Yes | `ENG Crew 1` | 11 Sep 2026 | Joint Opportunity #2 |
| **SNT-002** | SNT | A-B | Track Circuit Testing | Med | 40 | 30 | No | Yes | `S&T Crew 1` | 12 Sep 2026 | Joint Opportunity #2 |
| **ENG-003** | ENG | C-D | Rail Fracture Follow-up | Crit | 75 | 60 | No | Yes | `ENG Crew 1` | 08 Sep 2026 | **Critical / Overdue** (Due before demo date) |
| **TRD-002** | TRD | C-D | Catenary Bracket Adjustment | High | 60 | 45 | Yes | Yes | `Tower Wagon 2` | 10 Sep 2026 | **Resource Constraint** (Assigned unavailable resource) |
| **TRD-003** | TRD | B-C | OHE Heavy Maintenance | High | 60 | 45 | Yes | No | `TRD Crew 1`, `Tower Wagon 1` | 12 Sep 2026 | **Conflict Item** (Mandates 25kV power cut) |
| **TRD-004** | TRD | B-C | Mast Foundation Grounding | Med | 60 | 45 | Yes | No | `OHE Isolation Team 1` | 13 Sep 2026 | **Conflict Item** (Conflicts with TRD-003) |
| **SNT-003** | SNT | C-D | Routine Signal Inspection | Low | 30 | 20 | No | Yes | `S&T Crew 1` | 14 Sep 2026 | **Low Priority** (Safely deferable if congested) |
| **ENG-004** | ENG | A-B | Turnout Packing & Alignment | Med | 60 | 45 | No | Yes | `Track Tamper 1` | 13 Sep 2026 | Machinery Task (Tamper equipment utilization) |

---

## 5. Deliberate Compatibility Records
1. **Section B-C Cluster (ENG-001 + SNT-001)**:
   - Compatible civil track weld and signalling point machine servicing. Both can execute simultaneously within a shared track possession.
2. **Section A-B Cluster (ENG-002 + SNT-002)**:
   - Compatible track geometry verification and track circuit resistance audit co-located in a single block.

## 6. Deliberate Safety Conflict Records
- **TRD-003 & TRD-004 on Section B-C**:
  - Both tasks require high-voltage 25 kV AC traction power isolation on the same section.
  - SANGAM's conflict detection identifies this pair as incompatible for simultaneous execution, enforcing separate block windows.

## 7. Unavailable Resource Demonstrator
- **TRD-002 on Section C-D**:
  - Requires `Tower Wagon 2`, which is logged with status `is_available = False` (Periodic Overhaul).
  - Highlights resource bottleneck detection and readiness exceptions.

---

## 8. Expected Candidate Windows (10 Total)
Derived strictly from train timetable gaps with 10-minute statutory safety buffers:

### Section B-C (4 Windows)
1. `00:40 – 03:50` (190 min) — Between P101 (00:30 exit) and P102 (04:00 entry)
2. `04:40 – 06:50` (130 min) — Between P102 (04:30 exit) and G201 (07:00 entry)
3. `07:50 – 09:50` (120 min) — Between G201 (07:40 exit) and P103 (10:00 entry)
4. `10:40 – 14:40` (240 min) — Post-P103 daytime window (capped at 4h standard)

### Section A-B (3 Windows)
5. `00:10 – 00:50` (40 min) — Early morning buffer before P201
6. `01:40 – 04:50` (190 min) — Between P201 (01:30 exit) and P202 (05:00 entry)
7. `05:40 – 09:40` (240 min) — Morning post-P202 window

### Section C-D (3 Windows)
8. `00:10 – 01:50` (100 min) — Night clearance before P301
9. `02:40 – 05:50` (190 min) — Between P301 (02:30 exit) and P302 (06:00 entry)
10. `06:40 – 10:40` (240 min) — Morning post-P302 window

---

## 9. Actual Computed Planning Results

| Metric | Independent Siloed Baseline | SANGAM CP-SAT Optimizer | Net Operational Gain |
| :--- | :--- | :--- | :--- |
| **Corridor Blocks** | 9 separate blocks | **5 coordinated blocks** | **4 fewer track possessions** |
| **Total Block Closure** | 24.33 hours | **16.33 hours** | **8.00 hours saved (32.9% reduction)** |
| **Joint Bundling** | 0 joint blocks | **3 multi-department joint blocks** | Civil + S&T + Traction co-located |
| **Critical Task Coverage** | 100.0% | **100.0%** | Critical overdue fracture cleared |
| **Safety Conflicts** | Ignored in siloed scheduling | **0 violations (Strictly enforced)** | TRD-003 / TRD-004 separated |

---

## 10. Exact 3-Minute Judge Demonstration Sequence

```
1. Overview (/overview)
   "See the 11-task backlog across ENG, S&T, TRD, with 1 overdue task and 1 unavailable Tower Wagon."

2. Maintenance Work (/maintenance)
   "Inspect ENG-001, SNT-001, and TRD-001 tagged with purple [Demo Focus] badges on Section B-C."

3. Train & Corridor Data (/corridor-data)
   "Show P101 (00:00) and P102 (04:00) creating the clean candidate window 00:40–03:50 on Section B-C."

4. Proposed Plan (/planning/proposed)
   "Inspect the coordinated B-C joint block packaging civil weld repair, point machine check, and OHE work."

5. Compare Plans (/planning/compare)
   "Show the 8.0 hours saved (32.9% downtime reduction) vs today's siloed scheduling."

6. Approve Block (/planning/proposed)
   "Click 'Approve Block' on the B-C recommendation. Confirm its move to the Approved Blocks register."

7. Operational Re-Plan (/operations/replan)
   "Inject a disruption: Select train P102 with a +60 min delay. Click 'Run Operational Re-Plan'."

8. Revised Plan Diff (/operations/replan)
   "Show SANGAM's warm-started scoped CP-SAT re-solve: old vs new timings with zero cascading cancellations."
```
