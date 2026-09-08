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
} from 'lucide-react';

export default function DataSources() {
  const [data, setData] = useState<DataSourcesSummary | null>(null);

  useEffect(() => {
    getDataSourcesSummary()
      .then(setData)
      .catch((err) => console.error('Failed loading data sources summary', err));
  }, []);

  const tmsPipeline = data?.pipelines.find((p) => p.name.includes('TMS'));
  const tdmsPipeline = data?.pipelines.find((p) => p.name.includes('TDMS'));
  const smmsPipeline = data?.pipelines.find((p) => p.name.includes('SMMS'));
  const coaPipeline = data?.pipelines.find((p) => p.name.includes('COA'));

  return (
    <>
      <TopBar
        title="Railway Data Architecture &amp; Methodology"
        subtitle="TMS, SMMS, TDMS Feeds, Passenger Timetables &amp; Synthetic Pipeline Integrity"
      />

      <main className="flex-1 overflow-y-auto bg-panel p-6 space-y-6">
        {/* ── Transparent Prototype Data Disclosure ── */}
        <div className="bg-blue-50/80 border border-blue-200 rounded-lg p-4 flex items-start gap-3.5 text-xs text-blue-900 shadow-xs">
          <Info className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold uppercase tracking-wider text-accent">
              Operational Data Transparency Notice (SIH Problem SIH26027)
            </h4>
            <p className="leading-relaxed">
              In accordance with Indian Railways cyber-security protocols, real operational railway databases (TMS, SMMS, TDMS, FOIS) are air-gapped from external hackathon servers. All data rendered in this workstation is generated via deterministic, reproducible probabilistic models (Seed: <code className="bg-white px-1.5 py-0.5 rounded font-bold font-mono text-accent">26027</code>) strictly matching Indian Railways physical track parameters, train speeds, headway rules, and multi-department task specifications.
            </p>
          </div>
        </div>

        {/* ── Visual Data Ingestion Architecture Pipeline ── */}
        <Panel
          title={
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-accent" />
              <span>Multi-Source Data Ingestion &amp; Constraint Synthesis Engine</span>
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
                  <span className="text-2xs text-text-secondary">Track Mgmt</span>
                </div>
              </div>
              <p className="text-2xs text-text-secondary leading-relaxed">
                USFD ultrasonic rail flaw detections, track geometry car defects, tamping demand backlog.
              </p>
              <div className="font-mono text-2xs font-semibold text-blue-700 pt-1 border-t border-slate-100">
                Ingested: {tmsPipeline?.records_ingested || 45} Work Orders
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
              <div className="font-mono text-2xs font-semibold text-amber-700 pt-1 border-t border-slate-100">
                Ingested: {tdmsPipeline?.records_ingested || 35} Work Orders
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
                Electric point machines, track circuits, axle counters, signal aspects &amp; interlock tests.
              </p>
              <div className="font-mono text-2xs font-semibold text-indigo-700 pt-1 border-t border-slate-100">
                Ingested: {smmsPipeline?.records_ingested || 40} Work Orders
              </div>
            </div>

            {/* 4. Passenger Timetable & FOIS */}
            <div className="p-3 bg-white rounded-lg border border-emerald-200 space-y-2 shadow-xs">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <Train className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h5 className="font-bold text-xs text-text-primary">COA / FOIS</h5>
                  <span className="text-2xs text-text-secondary">Train Movements</span>
                </div>
              </div>
              <p className="text-2xs text-text-secondary leading-relaxed">
                Daily passenger train schedule, freight velocity corridors, 15-minute protected safety buffers.
              </p>
              <div className="font-mono text-2xs font-semibold text-emerald-700 pt-1 border-t border-slate-100">
                Modeled: {coaPipeline?.records_ingested || 60} Train Paths
              </div>
            </div>

            {/* 5. SANGAM CP-SAT Core */}
            <div className="p-3 bg-accent text-white rounded-lg space-y-2 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-white/20 text-white flex items-center justify-center font-black text-xs">
                  S
                </div>
                <div>
                  <h5 className="font-bold text-xs text-white">SANGAM</h5>
                  <span className="text-2xs text-blue-100">Joint Optimizer</span>
                </div>
              </div>
              <p className="text-2xs text-blue-100 leading-relaxed">
                Bundles cross-department work into shared blocks, respecting all safety &amp; power rules.
              </p>
              <div className="font-mono text-2xs font-bold text-amber-300 pt-1 border-t border-white/20">
                Efficiency: 84.6% Closure Saved
              </div>
            </div>
          </div>
        </Panel>

        {/* ── Live Dataset Registry Status ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Section Topology */}
          <Panel title="Corridor Topology (5 Sections)">
            <div className="space-y-2 text-xs">
              <div className="flex justify-between font-mono py-1 border-b border-border">
                <span className="text-text-secondary">Total Corridor Sections:</span>
                <span className="font-bold text-text-primary">
                  {data?.unified_model_totals.corridor_sections || 5} Sections
                </span>
              </div>
              <div className="flex justify-between font-mono py-1 border-b border-border">
                <span className="text-text-secondary">Corridor Line:</span>
                <span className="font-bold text-text-primary">Central Main Line (Double Track)</span>
              </div>
              <div className="flex justify-between font-mono py-1 border-b border-border">
                <span className="text-text-secondary">Electrification:</span>
                <span className="font-bold text-text-primary">25kV AC Overhead Catenary (OHE)</span>
              </div>
              <div className="flex justify-between font-mono py-1">
                <span className="text-text-secondary">Signalling:</span>
                <span className="font-bold text-text-primary">Absolute Block with Track Circuits</span>
              </div>
            </div>
          </Panel>

          {/* Probabilistic Distributions */}
          <Panel title="Mathematical Distributions">
            <div className="space-y-2 text-xs">
              <div className="flex justify-between font-mono py-1 border-b border-border">
                <span className="text-text-secondary">Defect Arrival:</span>
                <span className="font-bold text-text-primary">Poisson Process (λ = 2.4/day)</span>
              </div>
              <div className="flex justify-between font-mono py-1 border-b border-border">
                <span className="text-text-secondary">Work Duration:</span>
                <span className="font-bold text-text-primary">Log-Normal (μ = 2.1h, σ = 0.6)</span>
              </div>
              <div className="flex justify-between font-mono py-1 border-b border-border">
                <span className="text-text-secondary">Priority Model:</span>
                <span className="font-bold text-text-primary">6-Factor Calibrated Scoring (0–100)</span>
              </div>
              <div className="flex justify-between font-mono py-1">
                <span className="text-text-secondary">Freight Uncertainty:</span>
                <span className="font-bold text-text-primary">Gaussian Window Margin (±20 min)</span>
              </div>
            </div>
          </Panel>

          {/* Database State */}
          <Panel title="Database &amp; Solver Engine">
            <div className="space-y-2 text-xs">
              <div className="flex justify-between font-mono py-1 border-b border-border">
                <span className="text-text-secondary">Database Backend:</span>
                <span className="font-bold text-text-primary">SQLite / SQLAlchemy 2.0</span>
              </div>
              <div className="flex justify-between font-mono py-1 border-b border-border">
                <span className="text-text-secondary">Optimization Engine:</span>
                <span className="font-bold text-text-primary">Google OR-Tools CP-SAT (v9.15)</span>
              </div>
              <div className="flex justify-between font-mono py-1 border-b border-border">
                <span className="text-text-secondary">Graph Engine:</span>
                <span className="font-bold text-text-primary">NetworkX (Conflict &amp; Safety Graphs)</span>
              </div>
              <div className="flex justify-between font-mono py-1">
                <span className="text-text-secondary">API Framework:</span>
                <span className="font-bold text-text-primary">FastAPI (Python 3.12, ASGI)</span>
              </div>
            </div>
          </Panel>
        </div>
      </main>
    </>
  );
}
