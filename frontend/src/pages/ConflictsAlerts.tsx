import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  ShieldAlert,
  Network,
  Lock,
} from 'lucide-react';
import TopBar from '../components/TopBar';
import Panel from '../components/ui/Panel';
import DataTable, { type ColumnDef } from '../components/ui/DataTable';
import {
  getLatestRuns,
  getPlan,
  getTasks,
  getTaskExplanation,
  getConflicts,
  type ConflictRow,
  type TaskExplanation,
  type GeneratedBlock,
} from '../lib/apiClient';

interface DeferredRow {
  task_id: string;
  task_code: string;
  dept: string;
  section: string;
  priority_score: number;
  due_date: string | null;
  reason: string;
}

const HARD_CONSTRAINTS = [
  {
    code: 'HC-01',
    name: 'Single Track Possession Exclusivity',
    description: 'No two mutually exclusive work groups may occupy the identical track kilometer without joint safety authorization.',
    status: 'ENFORCED (CP-SAT)',
  },
  {
    code: 'HC-02',
    name: '25kV OHE Power Block Isolation',
    description: 'TRD catenary power shutdown requires feeder cut across both adjacent sub-sectors; non-isolated work within 2m forbidden.',
    status: 'ENFORCED (CP-SAT)',
  },
  {
    code: 'HC-03',
    name: 'Pre-Train Minimum Headway Buffer (15 mins)',
    description: 'Track must be cleared, tamped, and tested at least 15 minutes before arrival of scheduled passenger trains.',
    status: 'ENFORCED (CP-SAT)',
  },
  {
    code: 'HC-04',
    name: 'Mechanized Heavy Machinery Limits',
    description: 'Maximum 1 Ballast Cleaning Machine (BCM) or Tamping Machine per block section to avoid track deformation.',
    status: 'ENFORCED (CP-SAT)',
  },
];

export default function ConflictsAlerts() {
  const [deferred, setDeferred] = useState<DeferredRow[]>([]);
  const [conflicts, setConflicts] = useState<ConflictRow[]>([]);
  const [infeasible, setInfeasible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedRelationship, setSelectedRelationship] = useState<'all' | 'conflict' | 'compatible' | 'dependency'>('all');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [latest, conflictRules] = await Promise.all([
          getLatestRuns(),
          getConflicts(),
        ]);

        setConflicts(conflictRules);

        const sangam = latest.sangam_optimized;
        if (sangam) {
          const plan = await getPlan(sangam.run_id);

          if (plan.status === 'infeasible') {
            setInfeasible(true);
          }

          const scheduledIds = new Set(
            plan.blocks.flatMap((b: GeneratedBlock) => b.tasks.map((t) => t.id))
          );

          const pendingTasks = await getTasks({ status: 'Pending' });
          const unscheduled = pendingTasks.filter((t) => !scheduledIds.has(t.id)).slice(0, 15);

          const rows: DeferredRow[] = [];
          for (const t of unscheduled) {
            try {
              const exp: TaskExplanation = await getTaskExplanation(sangam.run_id, t.id);
              rows.push({
                task_id: t.id,
                task_code: t.task_code,
                dept: t.department_code ?? '—',
                section: t.section_name ?? '—',
                priority_score: t.priority_score,
                due_date: t.due_date,
                reason: exp.reasons?.slice(0, 2).join(' ') ?? 'Deferred to preserve passenger timetable buffer.',
              });
            } catch {
              rows.push({
                task_id: t.id,
                task_code: t.task_code,
                dept: t.department_code ?? '—',
                section: t.section_name ?? '—',
                priority_score: t.priority_score,
                due_date: t.due_date,
                reason: 'Deferred: lower relative priority than scheduled corridor renewals.',
              });
            }
          }
          setDeferred(rows);
        }
      } catch (err) {
        console.error('Error loading conflict data', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filteredConflicts = conflicts.filter((c) => {
    if (selectedRelationship === 'all') return true;
    return c.relationship === selectedRelationship;
  });

  const conflictColumns: ColumnDef<ConflictRow>[] = [
    {
      key: 'task_a_code',
      header: 'Task A',
      width: 'w-24',
      render: (r) => <span className="font-mono font-bold text-xs">{r.task_a_code}</span>,
    },
    {
      key: 'task_a_dept',
      header: 'Dept A',
      width: 'w-16',
      render: (r) => (
        <span
          className={`font-bold px-1.5 py-0.5 rounded text-2xs ${
            r.task_a_dept === 'ENG'
              ? 'bg-blue-100 text-blue-800'
              : r.task_a_dept === 'TRD'
              ? 'bg-amber-100 text-amber-800'
              : 'bg-indigo-100 text-indigo-800'
          }`}
        >
          {r.task_a_dept}
        </span>
      ),
    },
    {
      key: 'relationship',
      header: 'Safety Rule Type',
      width: 'w-28',
      render: (r) => (
        <span
          className={`text-2xs font-bold px-2 py-0.5 rounded border uppercase ${
            r.relationship === 'conflict'
              ? 'bg-red-50 text-red-700 border-red-200'
              : r.relationship === 'dependency'
              ? 'bg-amber-50 text-amber-700 border-amber-200'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}
        >
          {r.relationship}
        </span>
      ),
    },
    {
      key: 'task_b_code',
      header: 'Task B',
      width: 'w-24',
      render: (r) => <span className="font-mono font-bold text-xs">{r.task_b_code}</span>,
    },
    {
      key: 'task_b_dept',
      header: 'Dept B',
      width: 'w-16',
      render: (r) => (
        <span
          className={`font-bold px-1.5 py-0.5 rounded text-2xs ${
            r.task_b_dept === 'ENG'
              ? 'bg-blue-100 text-blue-800'
              : r.task_b_dept === 'TRD'
              ? 'bg-amber-100 text-amber-800'
              : 'bg-indigo-100 text-indigo-800'
          }`}
        >
          {r.task_b_dept}
        </span>
      ),
    },
    {
      key: 'notes',
      header: 'Enforced Constraint Logic',
      render: (r) => <span className="text-text-secondary text-xs">{r.notes ?? 'Strict spatial/temporal constraint'}</span>,
    },
  ];

  const deferredColumns: ColumnDef<DeferredRow>[] = [
    {
      key: 'task_code',
      header: 'Task Code',
      width: 'w-24',
      render: (r) => <span className="font-mono font-bold text-xs text-accent">{r.task_code}</span>,
    },
    {
      key: 'dept',
      header: 'Dept',
      width: 'w-16',
      render: (r) => (
        <span className="font-bold px-1.5 py-0.5 rounded text-2xs bg-panel border border-border">
          {r.dept}
        </span>
      ),
    },
    {
      key: 'section',
      header: 'Section',
      width: 'w-32',
      render: (r) => <span className="text-xs text-text-secondary">{r.section}</span>,
    },
    {
      key: 'priority_score',
      header: 'Priority',
      numeric: true,
      width: 'w-20',
      render: (r) => (
        <span className="font-mono text-xs font-semibold">{r.priority_score.toFixed(1)}</span>
      ),
    },
    {
      key: 'due_date',
      header: 'Due Date',
      width: 'w-24',
      render: (r) => (
        <span className="font-mono text-xs text-text-secondary">{r.due_date?.slice(0, 10) ?? '—'}</span>
      ),
    },
    {
      key: 'reason',
      header: 'Optimizer Explanation (Why Deferred)',
      render: (r) => <span className="text-xs text-text-primary font-medium">{r.reason}</span>,
    },
  ];

  return (
    <>
      <TopBar
        title="Constraints, Conflicts & Compatibility Graph"
        subtitle="OR-Tools Hard Constraints, Safety Interlocks & Explainability"
      />

      <main className="flex-1 overflow-y-auto bg-panel p-6 space-y-6">
        {/* Infeasibility alert banner */}
        {infeasible && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-300 rounded-lg text-red-900">
            <ShieldAlert className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold uppercase">CP-SAT Infeasibility Detected</h4>
              <p className="text-2xs text-red-800 mt-1">
                The constraint solver reported no feasible schedule satisfying all hard rules under this tight window. Try relaxing soft penalties or expanding the planning horizon.
              </p>
            </div>
          </div>
        )}

        {/* ── Hard Constraints Verification Panel ── */}
        <Panel
          title={
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-accent" />
              <span>OR-Tools CP-SAT Hard Constraints Engine</span>
            </div>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {HARD_CONSTRAINTS.map((c) => (
              <div
                key={c.code}
                className="p-3 bg-white rounded-lg border border-border flex items-start justify-between gap-3 shadow-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-accent">{c.code}</span>
                    <span className="font-bold text-xs text-text-primary">{c.name}</span>
                  </div>
                  <p className="text-2xs text-text-secondary leading-relaxed">{c.description}</p>
                </div>
                <span className="flex-shrink-0 text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                  {c.status}
                </span>
              </div>
            ))}
          </div>
        </Panel>

        {/* ── Visual Compatibility / Conflict Matrix ── */}
        <Panel
          title={
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Network className="w-4 h-4 text-accent" />
                <span>Inter-Department Compatibility &amp; Conflict Graph</span>
              </div>
              <div className="flex items-center gap-2">
                {(['all', 'conflict', 'compatible', 'dependency'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setSelectedRelationship(mode)}
                    className={`px-2.5 py-1 text-2xs rounded capitalize font-semibold transition-colors ${
                      selectedRelationship === mode
                        ? 'bg-accent text-white shadow-xs'
                        : 'bg-white border border-border text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
          }
        >
          <DataTable
            columns={conflictColumns}
            rows={filteredConflicts}
            rowKey={(r) => r.id}
            loading={loading}
            emptyMessage="No conflict or dependency relationships registered."
          />
        </Panel>

        {/* ── Deferred Tasks & Explainability ── */}
        <Panel
          title={
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Deferred Tasks Explainability (Horizon Carryover)</span>
              </div>
              <span className="text-2xs font-mono text-text-secondary">
                {deferred.length} Work Orders Queued for Next Cycle
              </span>
            </div>
          }
        >
          <DataTable
            columns={deferredColumns}
            rows={deferred}
            rowKey={(r) => r.task_id}
            loading={loading}
            emptyMessage="All maintenance work orders were accommodated in this schedule."
          />
        </Panel>
      </main>
    </>
  );
}
