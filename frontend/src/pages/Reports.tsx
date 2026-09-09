import { useState, useEffect } from 'react';
import TopBar from '../components/TopBar';
import { PageGuideBanner } from '../components/ui/PageGuideBanner';
import {
  getLatestRuns,
  getPlan,
  getDashboardSummary,
  type PlanDetail,
  type DashboardSummary,
} from '../lib/apiClient';
import { Printer, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Reports() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [plan, setPlan] = useState<PlanDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [sumData, latestRuns] = await Promise.all([
          getDashboardSummary().catch(() => null),
          getLatestRuns().catch(() => ({})),
        ]);
        setSummary(sumData);

        const optId = (latestRuns as any)?.sangam_optimized?.run_id;
        if (optId) {
          const planData = await getPlan(optId).catch(() => null);
          setPlan(planData);
        }
      } catch (err) {
        console.error('Failed loading report data', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function handlePrint() {
    window.print();
  }

  const hasPlan = plan && plan.blocks && plan.blocks.length > 0;
  const savings = summary?.downtime_savings;

  const totalTasksInBlocks = hasPlan
    ? plan.blocks.reduce((acc, b) => acc + (b.tasks?.length || 0), 0)
    : 0;

  const jointBlocksCount = hasPlan
    ? plan.blocks.filter((b) => b.is_joint_block).length
    : 0;

  const jointRatePct = hasPlan && plan.blocks.length > 0
    ? ((jointBlocksCount / plan.blocks.length) * 100).toFixed(0)
    : '0';

  // Group tasks by department for section 3
  const tasksByDept: Record<string, string[]> = { ENG: [], TRD: [], SNT: [] };
  if (hasPlan) {
    plan.blocks.forEach((b) => {
      b.tasks.forEach((t) => {
        const d = t.department || 'ENG';
        if (!tasksByDept[d]) tasksByDept[d] = [];
        const label = `${t.task_code}: ${t.maintenance_type}`;
        if (!tasksByDept[d].includes(label)) {
          tasksByDept[d].push(label);
        }
      });
    });
  }

  return (
    <>
      <TopBar
        title="Weekly Block Planning Summary Report"
        subtitle="Official Divisional Joint Possession Programme (Printable Dispatch Document)"
      />

      <main className="flex-1 overflow-y-auto bg-panel p-6 space-y-6">
        <div className="no-print">
          <PageGuideBanner
            pageTitle="Sanction Reports"
            purpose="Generate and dispatch official Indian Railways joint possession circulars. Formatted according to standard operating templates for Divisional Railway Manager (DRM) and Senior Divisional Operations Manager (Sr. DOM) review and signature."
            inputs={['Approved Block Plan Schedule', 'Department Task Listings', 'Traction Isolation Notes']}
            outputs={['Printable Official Operating Circular', 'PDF Dispatch Notice', 'DRM Sanction Register']}
            nextStep={{ label: 'Return to Operations Overview', to: '/' }}
          />
        </div>

        {/* Action Header */}
        <div className="flex items-center justify-between no-print">
          <span className="text-xs text-text-secondary font-medium">
            Format: Standard Indian Railways Joint Maintenance Circular · Ready for DRM / Sr. DOM review.
          </span>
          {hasPlan && (
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-white text-xs font-bold hover:bg-accent-hover transition-colors shadow-xs cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save as PDF</span>
            </button>
          )}
        </div>

        {!hasPlan && !loading && (
          <div className="bg-white border border-[#D9E1EA] rounded-xl p-10 text-center shadow-xs max-w-xl mx-auto space-y-3">
            <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-[#172033]">No approved plan available</h3>
            <p className="text-xs text-[#667085] leading-relaxed">
              No generated block schedule exists yet. Please generate a block plan in the Plan Creator or initialize standard corridor records to inspect live executive sanction metrics.
            </p>
            <div className="pt-2 flex items-center justify-center gap-3">
              <Link
                to="/planning/create"
                className="px-4 py-2 rounded-md bg-[#173F7A] text-white text-xs font-bold hover:bg-[#1E4E8C] transition-colors shadow-xs"
              >
                Create Block Plan
              </Link>
              <Link
                to="/rules"
                className="px-4 py-2 rounded-md bg-white border border-[#D9E1EA] text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
              >
                Initialize Operations
              </Link>
            </div>
          </div>
        )}

        {/* ── Official Report Document ── */}
        {hasPlan && (
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
                Period: {plan?.blocks?.[0]?.block_start ? `${plan.blocks[0].block_start.slice(0, 10)} to 2026-09-13` : '2026-09-09 to 2026-09-13'} · Document Ref: IR/CR/OPT/BLK-2026/W37 · System: SANGAM CP-SAT
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
                      {savings ? savings.baseline_hours.toFixed(1) : '—'} hrs
                    </td>
                    <td className="border border-slate-300 p-2 font-semibold">SANGAM Coordinated Hours:</td>
                    <td className="border border-slate-300 p-2 font-mono font-bold text-accent">
                      {savings ? savings.optimized_hours.toFixed(1) : '—'} hrs
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-slate-300 p-2 font-semibold">Net Corridor Hours Saved:</td>
                    <td className="border border-slate-300 p-2 font-mono font-black text-emerald-700">
                      {savings ? savings.hours_saved.toFixed(1) : '—'} hrs
                    </td>
                    <td className="border border-slate-300 p-2 font-semibold">Corridor Availability Gain:</td>
                    <td className="border border-slate-300 p-2 font-mono font-black text-blue-700">
                      {savings ? `${savings.percent_saved.toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="border border-slate-300 p-2 font-semibold">Work Orders Cleared:</td>
                    <td className="border border-slate-300 p-2 font-mono">
                      {totalTasksInBlocks} tasks scheduled across {plan.blocks.length} blocks
                    </td>
                    <td className="border border-slate-300 p-2 font-semibold">Joint Possession Rate:</td>
                    <td className="border border-slate-300 p-2 font-mono font-bold">
                      {jointRatePct}% ({jointBlocksCount} joint blocks)
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
                  {plan.blocks.map((b) => (
                    <tr key={b.id} className="border-b border-slate-200">
                      <td className="border border-slate-300 p-2 font-mono font-bold">
                        #{b.id.slice(0, 8)}
                      </td>
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
                        {b.approval_status?.toUpperCase() || 'RECOMMENDED'}
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-sans text-xs">
                <div className="p-3 border border-slate-300 rounded bg-slate-50">
                  <div className="font-bold text-slate-800 border-b border-slate-200 pb-1 mb-2">
                    Civil &amp; Track (ENG)
                  </div>
                  <div className="text-2xs text-slate-600 space-y-1">
                    {tasksByDept.ENG.length > 0 ? (
                      tasksByDept.ENG.map((t, i) => <div key={i}>• {t}</div>)
                    ) : (
                      <div>No civil tasks assigned</div>
                    )}
                  </div>
                </div>
                <div className="p-3 border border-slate-300 rounded bg-slate-50">
                  <div className="font-bold text-slate-800 border-b border-slate-200 pb-1 mb-2">
                    Traction / OHE (TRD)
                  </div>
                  <div className="text-2xs text-slate-600 space-y-1">
                    {tasksByDept.TRD.length > 0 ? (
                      tasksByDept.TRD.map((t, i) => <div key={i}>• {t}</div>)
                    ) : (
                      <div>No traction tasks assigned</div>
                    )}
                  </div>
                </div>
                <div className="p-3 border border-slate-300 rounded bg-slate-50">
                  <div className="font-bold text-slate-800 border-b border-slate-200 pb-1 mb-2">
                    Signalling &amp; Telecom (S&amp;T)
                  </div>
                  <div className="text-2xs text-slate-600 space-y-1">
                    {tasksByDept.SNT.length > 0 ? (
                      tasksByDept.SNT.map((t, i) => <div key={i}>• {t}</div>)
                    ) : (
                      <div>No signalling tasks assigned</div>
                    )}
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

            {/* Operational Disclosure Stamp */}
            <div className="mt-8 pt-3 border-t border-slate-200 text-center text-[10px] text-slate-400 font-sans">
              CONFIDENTIAL · OFFICIAL INDIAN RAILWAYS JOINT BLOCK DISPATCH · CENTRAL DIVISION
            </div>
          </div>
        )}
      </main>
    </>
  );
}
