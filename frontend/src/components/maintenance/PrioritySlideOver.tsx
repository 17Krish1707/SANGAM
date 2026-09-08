/**
 * PrioritySlideOver — right-side overlay showing:
 *  - Full task detail
 *  - Priority score breakdown from GET /api/tasks/{id}/priority-breakdown
 *    rendered as a labelled horizontal bar chart (no library, pure CSS widths)
 */
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import StatusBadge from '../ui/StatusBadge';
import type { BadgeVariant } from '../ui/StatusBadge';
import {
  getTaskPriorityBreakdown,
  type MaintenanceTask,
  type PriorityBreakdown,
  type PriorityFactor,
} from '../../lib/apiClient';

interface PrioritySlideOverProps {
  task: MaintenanceTask | null;
  onClose: () => void;
}

function severityVariant(s: string): BadgeVariant {
  if (s === 'Critical') return 'critical';
  if (s === 'High')     return 'critical';
  if (s === 'Medium')   return 'warning';
  return 'neutral';
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function fmtBool(v: boolean) {
  return v ? 'Yes' : 'No';
}

/** Single factor row: label + % bar + contribution value */
function FactorRow({ factor }: { factor: PriorityFactor }) {
  // contribution is 0-100 scale value for that factor
  const barWidth = Math.min(100, Math.max(0, factor.contribution));
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-xs">
        <span className="text-text-secondary font-medium">{factor.factor}</span>
        <span className="tabular-nums font-semibold text-text-primary">{factor.contribution.toFixed(1)}</span>
      </div>
      <div className="h-2 bg-panel rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-accent transition-all duration-300"
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <p className="text-2xs text-text-secondary">{factor.detail}</p>
    </div>
  );
}

export default function PrioritySlideOver({ task, onClose }: PrioritySlideOverProps) {
  const [breakdown, setBreakdown] = useState<PriorityBreakdown | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(false);

  useEffect(() => {
    if (!task) { setBreakdown(null); return; }
    setLoading(true);
    setError(false);
    getTaskPriorityBreakdown(task.id)
      .then(setBreakdown)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [task?.id]);

  if (!task) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-30 bg-black/10"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <aside
        className="fixed right-0 top-0 bottom-0 z-40 w-96 bg-white border-l border-border shadow-overlay
                   flex flex-col overflow-hidden"
        aria-label="Task detail"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div>
            <p className="text-sm font-bold text-text-primary">{task.task_code}</p>
            <p className="text-xs text-text-secondary mt-0.5">{task.maintenance_type}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-panel transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-text-secondary" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Status + severity row */}
          <div className="flex flex-wrap gap-2">
            <StatusBadge variant={severityVariant(task.severity)} label={task.severity} />
            <StatusBadge
              variant={task.status === 'Pending' ? 'warning' : task.status === 'Completed' ? 'good' : 'neutral'}
              label={task.status}
            />
          </div>

          {/* Detail grid */}
          <section>
            <h3 className="text-2xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Details</h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
              {[
                ['Department',  task.department_name ?? task.department_code ?? '—'],
                ['Section',     task.section_name ?? '—'],
                ['Asset',       task.asset_name ?? '—'],
                ['Detected',    fmtDate(task.detected_at)],
                ['Due Date',    fmtDate(task.due_date)],
                ['Est. Duration', `${task.estimated_duration_min} min`],
                ['Min Block',   `${task.minimum_contiguous_block_min} min`],
                ['Power Isolation', fmtBool(task.requires_power_isolation)],
                ['Can Parallel',    fmtBool(task.can_run_parallel)],
              ].map(([label, val]) => (
                <>
                  <dt key={`dt-${label}`} className="text-text-secondary font-medium">{label}</dt>
                  <dd key={`dd-${label}`} className="text-text-primary">{val}</dd>
                </>
              ))}
            </dl>
          </section>

          {/* Priority score + breakdown */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-2xs font-semibold text-text-secondary uppercase tracking-wide">
                Priority Score
              </h3>
              <span className="text-lg font-bold text-text-primary tabular-nums">
                {breakdown ? breakdown.score.toFixed(1) : (task.priority_score?.toFixed(1) ?? '—')}
                <span className="text-xs font-normal text-text-secondary"> / 100</span>
              </span>
            </div>

            {loading && (
              <div className="space-y-3">
                {[1,2,3,4,5].map((i) => (
                  <div key={i} className="h-8 bg-panel rounded animate-pulse" />
                ))}
              </div>
            )}

            {error && (
              <p className="text-xs text-text-secondary">
                Could not load priority breakdown.
              </p>
            )}

            {breakdown && !loading && (
              <div className="space-y-3">
                <p className="text-2xs text-text-secondary italic">
                  Why this priority? — weighted formula breakdown:
                </p>
                {breakdown.reasons.map((factor: PriorityFactor) => (
                  <FactorRow key={factor.factor} factor={factor} />
                ))}
              </div>
            )}
          </section>
        </div>
      </aside>
    </>
  );
}
