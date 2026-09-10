import { useEffect, useState } from 'react';
import { X, Zap } from 'lucide-react';
import { getTaskIntelligence, type TaskIntelligence } from '../../lib/apiClient';
import { MiniCorridorStatus } from '../railway';

interface TaskIntelligenceDrawerProps {
  taskId: string | null;
  onClose: () => void;
}

export default function TaskIntelligenceDrawer({
  taskId,
  onClose,
}: TaskIntelligenceDrawerProps) {
  const [intel, setIntel] = useState<TaskIntelligence | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!taskId) {
      setIntel(null);
      return;
    }
    setLoading(true);
    getTaskIntelligence(taskId)
      .then(setIntel)
      .catch((err) => console.error('Failed loading task intelligence:', err))
      .finally(() => setLoading(false));
  }, [taskId]);

  if (!taskId) return null;

  const task = intel?.task;
  const breakdown = intel?.priority_breakdown?.components;
  const compat = intel?.relationships?.compatible ?? [];
  const conflicts = intel?.relationships?.conflict ?? [];
  const windows = intel?.candidate_windows ?? [];
  const assignment = intel?.scheduled_assignment;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-[480px] bg-white border-l border-border shadow-overlay flex flex-col select-none animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 border-b border-border bg-panel flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-accent bg-accent-tint px-2 py-0.5 rounded border border-accent/20">
              {task?.task_code ?? taskId}
            </span>
            <span
              className={`text-2xs font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                task?.severity === 'Critical'
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : task?.severity === 'High'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-slate-50 text-slate-700 border-slate-200'
              }`}
            >
              {task?.severity ?? 'Pending'}
            </span>
            {task?.requires_power_isolation && (
              <span className="text-2xs font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 flex items-center gap-0.5">
                <Zap className="w-3 h-3" /> 25kV ISO
              </span>
            )}
          </div>
          <h3 className="text-base font-bold text-text-primary mt-1">
            {task?.maintenance_type ?? 'Maintenance Work Order'}
          </h3>
          <p className="text-2xs text-text-secondary">
            {task?.department_name} ({task?.department_code}) · {task?.section_name}
          </p>
        </div>

        <button
          onClick={onClose}
          className="p-1 text-text-secondary hover:text-text-primary rounded-md hover:bg-white transition-colors"
          aria-label="Close task intelligence"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {loading ? (
          <div className="py-12 text-center text-xs text-text-secondary font-mono">
            Loading task intelligence & compatibility graph...
          </div>
        ) : (
          <>
            {/* Priority Score Banner */}
            <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-card border border-border">
              <div>
                <span className="text-2xs font-mono uppercase font-bold text-text-secondary">
                  PRIORITY ENGINE SCORE
                </span>
                <div className="text-2xl font-black font-mono text-text-primary">
                  {task?.priority_score?.toFixed(0) ?? '—'}{' '}
                  <span className="text-xs text-text-secondary font-normal">/ 100</span>
                </div>
              </div>
              <div className="text-right text-2xs text-text-secondary">
                <div>Duration: <strong>{task?.estimated_duration_min} min</strong></div>
                <div>Min Contiguous Block: <strong>{task?.minimum_contiguous_block_min} min</strong></div>
              </div>
            </div>

            {/* Corridor Schematic Highlight */}
            <div>
              <span className="text-2xs font-mono uppercase font-bold text-text-secondary block mb-1.5">
                TRACK CORRIDOR LOCATION
              </span>
              <MiniCorridorStatus sectionName={task?.section_name ?? 'Matunga–Sion'} className="w-full justify-between px-4 py-2 bg-slate-50" />
              <div className="flex justify-between text-2xs text-text-secondary mt-1 px-1">
                <span>From: {task?.from_station}</span>
                <span>To: {task?.to_station}</span>
              </div>
            </div>

            {/* Priority Breakdown Contribution Bars */}
            <div>
              <span className="text-2xs font-mono uppercase font-bold text-text-secondary block mb-2">
                PRIORITY SCORE BREAKDOWN (6-FACTOR WEIGHTED FORMULA)
              </span>

              <div className="space-y-2 text-xs">
                {breakdown && Object.entries(breakdown).map(([factor, comp]) => {
                  const factorName = factor.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
                  const pct = Math.min(100, comp.contribution * 4); // for display scale

                  return (
                    <div key={factor} className="space-y-0.5">
                      <div className="flex justify-between text-2xs">
                        <span className="text-text-primary font-medium">{factorName}</span>
                        <span className="font-mono font-bold text-text-primary">+{comp.contribution}</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-text-secondary truncate">
                        {comp.detail}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Compatibility & Conflict Graph */}
            <div>
              <span className="text-2xs font-mono uppercase font-bold text-text-secondary block mb-2">
                NETWORKX TASK COMPATIBILITY GRAPH
              </span>

              {/* Mini SVG Relationship Graph */}
              <div className="p-3 bg-panel border border-border rounded-card mb-2">
                <div className="flex items-center justify-around py-2">
                  {/* Target Node */}
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center font-bold text-xs shadow-xs">
                      {task?.task_code.slice(0, 4)}
                    </div>
                    <span className="text-2xs font-bold text-accent mt-1">This Task</span>
                  </div>

                  {/* Connectors */}
                  <div className="flex flex-col gap-2 text-2xs font-bold">
                    <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                      ━ Compatible ({compat.length}) ━►
                    </span>
                    <span className="text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-300">
                      ━ Conflict ({conflicts.length}) ━►
                    </span>
                  </div>

                  {/* Other tasks summary */}
                  <div className="flex flex-col gap-1.5 text-2xs">
                    {compat[0] && (
                      <span className="px-2 py-1 bg-white border border-emerald-300 text-emerald-800 rounded font-mono font-bold">
                        {compat[0].task_code} ({compat[0].department})
                      </span>
                    )}
                    {conflicts[0] && (
                      <span className="px-2 py-1 bg-white border border-red-300 text-red-800 rounded font-mono font-bold">
                        {conflicts[0].task_code} ({conflicts[0].department})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Compatible list */}
              {compat.length > 0 && (
                <div className="mt-2 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-emerald-700">Parallel-Safe Co-location Partners:</span>
                  {compat.map((c) => (
                    <div key={c.task_id} className="p-2 bg-emerald-50/50 border border-emerald-200 rounded text-2xs flex justify-between">
                      <span className="font-mono font-bold text-emerald-900">{c.task_code} ({c.department})</span>
                      <span className="text-emerald-700">{c.type}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Conflicts list */}
              {conflicts.length > 0 && (
                <div className="mt-2 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-red-700">Safety Conflicts (Mutual Exclusion):</span>
                  {conflicts.map((c) => (
                    <div key={c.task_id} className="p-2 bg-red-50/50 border border-red-200 rounded text-2xs flex justify-between">
                      <span className="font-mono font-bold text-red-900">{c.task_code} ({c.department})</span>
                      <span className="text-red-700">{c.notes || 'Simultaneous track possession conflict'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Candidate Corridor Windows */}
            <div>
              <span className="text-2xs font-mono uppercase font-bold text-text-secondary block mb-2">
                CANDIDATE CORRIDOR WINDOWS (HEADWAY GAP ANALYSIS)
              </span>

              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {windows.slice(0, 4).map((w) => (
                  <div
                    key={w.id}
                    className={`p-2 rounded border text-2xs flex items-center justify-between ${
                      w.fits_duration ? 'bg-white border-border' : 'bg-slate-50 border-slate-200 opacity-60'
                    }`}
                  >
                    <div>
                      <div className="font-mono font-bold text-text-primary">
                        {w.window_start.slice(11, 16)} → {w.window_end.slice(11, 16)}
                      </div>
                      <span className="text-text-secondary">
                        {w.duration_min} min available {w.fits_duration ? '✓ Fits block' : '✕ Too short'}
                      </span>
                    </div>

                    <div className="text-right">
                      <span
                        className={`px-1.5 py-0.5 rounded font-mono font-bold ${
                          w.risk_level === 'Low'
                            ? 'bg-emerald-50 text-emerald-800'
                            : w.risk_level === 'Moderate'
                            ? 'bg-amber-50 text-amber-800'
                            : 'bg-red-50 text-red-800'
                        }`}
                      >
                        Risk {w.risk_score?.toFixed(2)} ({w.risk_level})
                      </span>
                      <div className="text-[10px] text-text-secondary mt-0.5">
                        {w.risk_breakdown?.nearby_train_count} nearby trains
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Current Allocation (if scheduled) */}
            {assignment && (
              <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-card">
                <span className="text-2xs font-bold text-accent uppercase tracking-wider block">
                  SCHEDULED IN LATEST PLAN
                </span>
                <div className="text-xs font-bold text-text-primary mt-1">
                  Window: {assignment.block_start.slice(11, 16)} → {assignment.block_end.slice(11, 16)} ({assignment.duration_min}m)
                </div>
                {assignment.is_joint_block && (
                  <div className="text-2xs text-accent mt-0.5 font-semibold">
                    Joint block with: {assignment.co_scheduled_tasks.map((t) => t.task_code).join(', ') || 'Department crew'}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
