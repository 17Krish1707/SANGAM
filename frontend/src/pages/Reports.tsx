import { useState, useEffect } from 'react';
import TopBar from '../components/TopBar';
import {
  getLatestRuns,
  getPlan,
  getDashboardSummary,
  type PlanDetail,
  type DashboardSummary,
} from '../lib/apiClient';
import { Printer } from 'lucide-react';

const DEMO_WEEK = '07-SEP-2026 to 13-SEP-2026';

export default function Reports() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [plan, setPlan] = useState<PlanDetail | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [sumData, latestRuns] = await Promise.all([
          getDashboardSummary(),
          getLatestRuns(),
        ]);
        setSummary(sumData);

        if (latestRuns.sangam_optimized?.run_id) {
          const planData = await getPlan(latestRuns.sangam_optimized.run_id);
          setPlan(planData);
        }
      } catch (err) {
        console.error('Failed loading report data', err);
      }
    }
    load();
  }, []);

  function handlePrint() {
    window.print();
  }

  return (
    <>
      <TopBar
        title="Weekly Block Planning Summary Report"
        subtitle="Official Divisional Joint Possession Programme (Printable Dispatch Document)"
      />

      <main className="flex-1 overflow-y-auto bg-panel p-6 space-y-6">
        {/* Action Header */}
        <div className="flex items-center justify-between no-print">
          <span className="text-xs text-text-secondary font-medium">
            Format: Standard Indian Railways Joint Maintenance Circular · Ready for DRM / Sr. DOM review.
          </span>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-white text-xs font-bold hover:bg-accent-hover transition-colors shadow-xs"
          >
            <Printer className="w-4 h-4" />
            Print / Save as PDF
          </button>
        </div>

        {/* ── Official Report Document ── */}
        <div className="bg-white border border-border shadow-md rounded-lg p-8 max-w-4xl mx-auto text-slate-800 font-serif print:border-none print:shadow-none print:p-0">
          {/* Official Letterhead */}
          <div className="text-center border-b-2 border-slate-900 pb-4 space-y-1">
            <h1 className="text-lg font-black tracking-widest uppercase">
              INDIAN RAILWAYS
            </h1>
            <h2 className="text-sm font-bold tracking-wider text-slate-700 uppercase">
              CENTRAL DIVISION · OPERATING DEPARTMENT
            </h2>
            <div className="text-xs font-mono text-slate-600 font-semibold pt-1">
              JOINT COORDINATED MAINTENANCE BLOCK PROGRAMME (WEEKLY)
            </div>
            <div className="text-2xs font-mono text-slate-500">
              Period: {DEMO_WEEK} · Document Ref: IR/CR/OPT/BLK-2026/W37 · System: SANGAM CP-SAT
            </div>
          </div>

          {/* Key Executive Summary Matrix */}
          <div className="my-6">
            <h3 className="text-xs font-sans font-bold text-slate-900 uppercase tracking-wider mb-2">
              1. Executive Operational Metrics
            </h3>
            <table className="w-full text-xs border-collapse border border-slate-300 font-sans">
              <tbody>
                <tr className="bg-slate-50">
                  <td className="border border-slate-300 p-2 font-semibold">Total Baseline Siloed Hours:</td>
                  <td className="border border-slate-300 p-2 font-mono font-bold">
                    {summary?.downtime_savings?.baseline_hours.toFixed(1) || '429.0'} hrs
                  </td>
                  <td className="border border-slate-300 p-2 font-semibold">SANGAM Coordinated Hours:</td>
                  <td className="border border-slate-300 p-2 font-mono font-bold text-accent">
                    {summary?.downtime_savings?.optimized_hours.toFixed(1) || '66.2'} hrs
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-300 p-2 font-semibold">Net Corridor Hours Saved:</td>
                  <td className="border border-slate-300 p-2 font-mono font-black text-emerald-700">
                    {summary?.downtime_savings?.hours_saved.toFixed(1) || '362.8'} hrs
                  </td>
                  <td className="border border-slate-300 p-2 font-semibold">Corridor Availability Gain:</td>
                  <td className="border border-slate-300 p-2 font-mono font-black text-blue-700">
                    {summary?.downtime_savings?.percent_saved.toFixed(1) || '84.6'}%
                  </td>
                </tr>
                <tr className="bg-slate-50">
                  <td className="border border-slate-300 p-2 font-semibold">Work Orders Cleared:</td>
                  <td className="border border-slate-300 p-2 font-mono">
                    {summary?.demand?.total_tasks ? (summary.demand.total_tasks - summary.demand.pending_count) : 108} of {summary?.demand?.total_tasks || 120} tasks
                  </td>
                  <td className="border border-slate-300 p-2 font-semibold">Joint Possession Rate:</td>
                  <td className="border border-slate-300 p-2 font-mono font-bold">
                    {plan?.blocks ? `${((plan.blocks.filter((b) => b.is_joint_block).length / plan.blocks.length) * 100).toFixed(0)}%` : '78%'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Section-wise Approved Block Schedule */}
          <div className="my-6">
            <h3 className="text-xs font-sans font-bold text-slate-900 uppercase tracking-wider mb-2">
              2. Approved Corridor Block Schedule
            </h3>
            <table className="w-full text-xs border-collapse border border-slate-300 font-sans">
              <thead>
                <tr className="bg-slate-100 text-[11px] font-bold text-slate-800">
                  <th className="border border-slate-300 p-2 text-left">Block ID</th>
                  <th className="border border-slate-300 p-2 text-left">Section</th>
                  <th className="border border-slate-300 p-2 text-left">Time Window</th>
                  <th className="border border-slate-300 p-2 text-center">Duration</th>
                  <th className="border border-slate-300 p-2 text-left">Departments</th>
                  <th className="border border-slate-300 p-2 text-center">Tasks</th>
                  <th className="border border-slate-300 p-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {(plan?.blocks || []).slice(0, 12).map((b) => (
                  <tr key={b.id} className="border-b border-slate-200">
                    <td className="border border-slate-300 p-2 font-mono font-bold">#{b.id}</td>
                    <td className="border border-slate-300 p-2">{b.section_name}</td>
                    <td className="border border-slate-300 p-2 font-mono text-2xs">
                      {b.block_start.slice(0, 10)} · {b.block_start.slice(11, 16)}–{b.block_end.slice(11, 16)}
                    </td>
                    <td className="border border-slate-300 p-2 text-center font-mono">{b.duration_min}m</td>
                    <td className="border border-slate-300 p-2">
                      <div className="flex items-center gap-1">
                        {[...new Set(b.tasks.map((t) => t.department))].join(' + ')}
                        {b.is_joint_block && (
                          <span className="text-[9px] font-bold bg-amber-200 text-amber-900 px-1 rounded ml-1">
                            JOINT
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="border border-slate-300 p-2 text-center font-mono">{b.tasks.length}</td>
                    <td className="border border-slate-300 p-2 text-center font-mono font-bold text-emerald-800">
                      APPROVED
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Departmental Allocation Summary */}
          <div className="my-6">
            <h3 className="text-xs font-sans font-bold text-slate-900 uppercase tracking-wider mb-2">
              3. Departmental Allocation Summary
            </h3>
            <div className="grid grid-cols-3 gap-3 font-sans text-xs">
              <div className="p-3 border border-slate-300 rounded bg-slate-50">
                <div className="font-bold text-slate-800">Civil & Track (ENG)</div>
                <div className="text-2xs text-slate-600 mt-1">
                  BCM machine tamping: 22km<br />
                  Turnout renewals: 4 units<br />
                  Rail weld thermit: 18 welds
                </div>
              </div>
              <div className="p-3 border border-slate-300 rounded bg-slate-50">
                <div className="font-bold text-slate-800">Traction / OHE (TRD)</div>
                <div className="text-2xs text-slate-600 mt-1">
                  Catenary adjustments: 31km<br />
                  Isolator overhaul: 6 substations<br />
                  Mast bonding: 42 locations
                </div>
              </div>
              <div className="p-3 border border-slate-300 rounded bg-slate-50">
                <div className="font-bold text-slate-800">Signalling & Telecom (S&T)</div>
                <div className="text-2xs text-slate-600 mt-1">
                  Point machines: 8 tests<br />
                  Axle counter calibration: 14 tracks<br />
                  Signal aspect overhaul: 11 signals
                </div>
              </div>
            </div>
          </div>

          {/* Signatures & Operational Clearances */}
          <div className="mt-12 pt-6 border-t-2 border-slate-900 font-sans">
            <div className="grid grid-cols-4 gap-4 text-center text-xs">
              <div className="space-y-8">
                <div className="h-8 border-b border-dashed border-slate-400" />
                <div>
                  <div className="font-bold text-slate-800">Sr. DEN (Co-ord)</div>
                  <div className="text-2xs text-slate-500">Engineering Dept.</div>
                </div>
              </div>
              <div className="space-y-8">
                <div className="h-8 border-b border-dashed border-slate-400" />
                <div>
                  <div className="font-bold text-slate-800">Sr. DEE (TRD)</div>
                  <div className="text-2xs text-slate-500">Traction Dept.</div>
                </div>
              </div>
              <div className="space-y-8">
                <div className="h-8 border-b border-dashed border-slate-400" />
                <div>
                  <div className="font-bold text-slate-800">Sr. DSTE</div>
                  <div className="text-2xs text-slate-500">S&amp;T Dept.</div>
                </div>
              </div>
              <div className="space-y-8">
                <div className="h-8 border-b border-dashed border-slate-400" />
                <div>
                  <div className="font-bold text-slate-800">Dy. COM (Plg)</div>
                  <div className="text-2xs text-slate-500">Operating / Dispatch</div>
                </div>
              </div>
            </div>
          </div>

          {/* Synthetic Disclosure Stamp */}
          <div className="mt-8 pt-3 border-t border-slate-200 text-center text-[10px] text-slate-400 font-sans">
            CONFIDENTIAL · SYNTHETIC DEMONSTRATION RECORD · SIH 26027 CENTRAL DIVISION CORRIDOR
          </div>
        </div>
      </main>
    </>
  );
}
