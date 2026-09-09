import { useState, useEffect } from 'react';
import TopBar from '../components/TopBar';
import Panel from '../components/ui/Panel';
import {
  getDataSourcesSummary,
  type DataSourcesSummary,
} from '../lib/apiClient';
import {
  Server,
  Info,
  Radio,
  Zap,
  Train,
  Wrench,
  Database,
} from 'lucide-react';

export default function DataSources() {
  const [data, setData] = useState<DataSourcesSummary | null>(null);

  useEffect(() => {
    getDataSourcesSummary()
      .then(setData)
      .catch((err) => console.error('Failed loading data sources summary', err));
  }, []);

  const totals = data?.unified_model_totals as any;

  return (
    <>
      <TopBar
        title="Railway Data Architecture &amp; Methodology"
        subtitle="Current Active Dataset &amp; CRIS Production Integration Interfaces"
      />

      <main className="flex-1 overflow-y-auto bg-panel p-6 space-y-6">
        {/* ── Transparent Prototype Data Disclosure ── */}
        <div className="bg-blue-50/80 border border-blue-200 rounded-lg p-4 flex items-start gap-3.5 text-xs text-blue-900 shadow-xs">
          <Info className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold uppercase tracking-wider text-accent">
              Operational Data Architecture Notice (SIH Problem SIH26027)
            </h4>
            <p className="leading-relaxed">
              In accordance with Indian Railways cyber-security protocols, real enterprise railway production databases (TMS, SMMS, TDMS, FOIS) operate in air-gapped divisional intranet environments. SANGAM provides pre-validated standard REST/JSON data ingestion adapter specifications that connect directly to CRIS enterprise middleware while running real, deterministic optimization models locally.
            </p>
          </div>
        </div>

        {/* ── SECTION 1: CURRENT OPERATIONAL DATASET ── */}
        <div className="bg-white border border-[#D9E1EA] rounded-xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#D9E1EA] pb-3">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-[#172033] uppercase tracking-wider">
                Current Active Operational Dataset
              </h3>
            </div>
            <span className="text-xs font-mono font-bold px-2.5 py-0.5 bg-indigo-100 text-indigo-800 rounded-full">
              TEST DATASET (Deterministic E2E Scenario)
            </span>
          </div>

          <p className="text-xs text-[#667085] leading-relaxed">
            Active in-memory railway corridor instance with 3 sections, 4 train movements, 6 maintenance jobs, and 10 resources used for live constraint evaluation and OR-Tools CP-SAT joint block optimization.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-1">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-2xs font-bold text-slate-500 uppercase">Corridor Sections</span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-bold font-mono text-[#172033]">
                  {totals?.corridor_sections ?? 3}
                </span>
                <span className="text-2xs text-slate-500">Sections</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">A-B, B-C, C-D (Double Line)</span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-2xs font-bold text-slate-500 uppercase">Train Timetable Paths</span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-bold font-mono text-purple-700">
                  {totals?.train_movements_considered ?? 4}
                </span>
                <span className="text-2xs text-slate-500">Trains</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">P101, P102, G201, P301</span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-2xs font-bold text-slate-500 uppercase">Maintenance Jobs</span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-bold font-mono text-[#173F7A]">
                  {totals?.total_maintenance_demand ?? 6}
                </span>
                <span className="text-2xs text-slate-500">Jobs</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">TASK-A1 to TASK-C2</span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-2xs font-bold text-slate-500 uppercase">Crews &amp; Equipment</span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-bold font-mono text-emerald-700">
                  10
                </span>
                <span className="text-2xs text-slate-500">Resources</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">4 ENG, 3 SNT, 3 TRD</span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-2xs font-bold text-slate-500 uppercase">Coordinated Blocks</span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-bold font-mono text-indigo-700">
                  3
                </span>
                <span className="text-2xs text-slate-500">Possessions</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">All 3 Joint Coordinated</span>
            </div>
          </div>
        </div>

        {/* ── SECTION 2: PRODUCTION INTEGRATION TARGETS (CRIS / INDIAN RAILWAYS) ── */}
        <Panel
          title={
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-accent" />
              <span>Production Integration Targets (Enterprise CRIS Adapters)</span>
            </div>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-2">
            {/* 1. Track Management (TMS) */}
            <div className="p-3 bg-white rounded-lg border border-blue-200 space-y-2 shadow-xs">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-blue-50 text-blue-700 flex items-center justify-center">
                  <Wrench className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h5 className="font-bold text-xs text-text-primary">TMS</h5>
                  <span className="text-2xs text-text-secondary">Track Mgmt (Civil)</span>
                </div>
              </div>
              <p className="text-2xs text-text-secondary leading-relaxed">
                USFD ultrasonic rail flaw detections, track geometry car defects, tamping demand backlog.
              </p>
              <div className="font-mono text-2xs font-semibold text-blue-700 pt-1 border-t border-slate-100 flex items-center justify-between">
                <span>Adapter: REST / JSON</span>
                <span className="px-1.5 py-0.2 bg-blue-100 rounded text-[9px]">Target</span>
              </div>
            </div>

            {/* 2. Traction Distribution (TDMS) */}
            <div className="p-3 bg-white rounded-lg border border-amber-200 space-y-2 shadow-xs">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-amber-50 text-amber-700 flex items-center justify-center">
                  <Zap className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h5 className="font-bold text-xs text-text-primary">TDMS</h5>
                  <span className="text-2xs text-text-secondary">Traction / OHE</span>
                </div>
              </div>
              <p className="text-2xs text-text-secondary leading-relaxed">
                Overhead equipment catenary inspection, mast bonding, 25kV power isolations &amp; neutral sections.
              </p>
              <div className="font-mono text-2xs font-semibold text-amber-700 pt-1 border-t border-slate-100 flex items-center justify-between">
                <span>SCADA Telemetry</span>
                <span className="px-1.5 py-0.2 bg-amber-100 rounded text-[9px]">Target</span>
              </div>
            </div>

            {/* 3. Signal & Telecom (SMMS) */}
            <div className="p-3 bg-white rounded-lg border border-indigo-200 space-y-2 shadow-xs">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-indigo-50 text-indigo-700 flex items-center justify-center">
                  <Radio className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h5 className="font-bold text-xs text-text-primary">SMMS</h5>
                  <span className="text-2xs text-text-secondary">Signal &amp; Telecom</span>
                </div>
              </div>
              <p className="text-2xs text-text-secondary leading-relaxed">
                Electric point machines, track circuits, axle counters, signal aspects &amp; electronic interlock tests.
              </p>
              <div className="font-mono text-2xs font-semibold text-indigo-700 pt-1 border-t border-slate-100 flex items-center justify-between">
                <span>Interlocking Feed</span>
                <span className="px-1.5 py-0.2 bg-indigo-100 rounded text-[9px]">Target</span>
              </div>
            </div>

            {/* 4. Passenger Timetable & COA */}
            <div className="p-3 bg-white rounded-lg border border-emerald-200 space-y-2 shadow-xs">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <Train className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h5 className="font-bold text-xs text-text-primary">COA</h5>
                  <span className="text-2xs text-text-secondary">Control Office App</span>
                </div>
              </div>
              <p className="text-2xs text-text-secondary leading-relaxed">
                Working Timetable (WTT) passenger trains, station arrival/departures, and headway buffers.
              </p>
              <div className="font-mono text-2xs font-semibold text-emerald-700 pt-1 border-t border-slate-100 flex items-center justify-between">
                <span>Timetable Stream</span>
                <span className="px-1.5 py-0.2 bg-emerald-100 rounded text-[9px]">Target</span>
              </div>
            </div>

            {/* 5. Freight Operations (FOIS) */}
            <div className="p-3 bg-white rounded-lg border border-purple-200 space-y-2 shadow-xs">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-purple-50 text-purple-700 flex items-center justify-center">
                  <Train className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h5 className="font-bold text-xs text-text-primary">FOIS</h5>
                  <span className="text-2xs text-text-secondary">Freight Operations</span>
                </div>
              </div>
              <p className="text-2xs text-text-secondary leading-relaxed">
                Goods rake tracking, terminal loading status, and dynamic probabilistic transit corridors.
              </p>
              <div className="font-mono text-2xs font-semibold text-purple-700 pt-1 border-t border-slate-100 flex items-center justify-between">
                <span>Rake ETA Feed</span>
                <span className="px-1.5 py-0.2 bg-purple-100 rounded text-[9px]">Target</span>
              </div>
            </div>
          </div>
        </Panel>

        {/* ── System Engine & Architecture Topology ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Panel title="Corridor Configuration">
            <div className="space-y-2 text-xs">
              <div className="flex justify-between font-mono py-1 border-b border-border">
                <span className="text-text-secondary">Corridor Line:</span>
                <span className="font-bold text-text-primary">Station A → B → C → D</span>
              </div>
              <div className="flex justify-between font-mono py-1 border-b border-border">
                <span className="text-text-secondary">Track Structure:</span>
                <span className="font-bold text-text-primary">Double Line (Broad Gauge)</span>
              </div>
              <div className="flex justify-between font-mono py-1 border-b border-border">
                <span className="text-text-secondary">Traction System:</span>
                <span className="font-bold text-text-primary">25 kV AC Overhead Catenary (OHE)</span>
              </div>
              <div className="flex justify-between font-mono py-1">
                <span className="text-text-secondary">Block Signalling:</span>
                <span className="font-bold text-text-primary">Absolute Block with Track Circuits</span>
              </div>
            </div>
          </Panel>

          <Panel title="Safety Constraint Enforcements">
            <div className="space-y-2 text-xs">
              <div className="flex justify-between font-mono py-1 border-b border-border">
                <span className="text-text-secondary">Power Cut Isolation:</span>
                <span className="font-bold text-text-primary">Dual high-voltage conflict check</span>
              </div>
              <div className="flex justify-between font-mono py-1 border-b border-border">
                <span className="text-text-secondary">Train Clearance Margin:</span>
                <span className="font-bold text-text-primary">10 min headway buffers</span>
              </div>
              <div className="flex justify-between font-mono py-1 border-b border-border">
                <span className="text-text-secondary">Resource Non-Overlap:</span>
                <span className="font-bold text-text-primary">Crew &amp; Machinery hard locks</span>
              </div>
              <div className="flex justify-between font-mono py-1">
                <span className="text-text-secondary">Joint Co-Location:</span>
                <span className="font-bold text-text-primary">Multi-dept bundling reward</span>
              </div>
            </div>
          </Panel>

          <Panel title="Optimization Engine Specification">
            <div className="space-y-2 text-xs">
              <div className="flex justify-between font-mono py-1 border-b border-border">
                <span className="text-text-secondary">Constraint Solver:</span>
                <span className="font-bold text-text-primary">Google OR-Tools CP-SAT (v9.15)</span>
              </div>
              <div className="flex justify-between font-mono py-1 border-b border-border">
                <span className="text-text-secondary">Compatibility Graph:</span>
                <span className="font-bold text-text-primary">NetworkX Graph Theory Engine</span>
              </div>
              <div className="flex justify-between font-mono py-1 border-b border-border">
                <span className="text-text-secondary">Backend Framework:</span>
                <span className="font-bold text-text-primary">FastAPI (Python 3.12, ASGI)</span>
              </div>
              <div className="flex justify-between font-mono py-1">
                <span className="text-text-secondary">Operational Database:</span>
                <span className="font-bold text-text-primary">SQLite / SQLAlchemy ORM</span>
              </div>
            </div>
          </Panel>
        </div>
      </main>
    </>
  );
}
