import React from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlanning } from '../context/PlanningContext';
import { ChevronRight, Check, AlertTriangle } from 'lucide-react';

interface Stage {
  num: number;
  label: string;
  sublabel: string;
  path: string;
}

const STAGES: Stage[] = [
  { num: 1, label: 'Maintenance Demand', sublabel: 'Requirements', path: '/maintenance' },
  { num: 2, label: 'Corridor & Trains',  sublabel: 'Availability', path: '/corridor-data' },
  { num: 3, label: 'Resources',          sublabel: 'Constraints',  path: '/resources' },
  { num: 4, label: 'Create Plan',        sublabel: 'Optimization', path: '/planning/create' },
  { num: 5, label: 'Proposed Plan',      sublabel: 'Review & Edit',path: '/planning/proposed' },
  { num: 6, label: 'Approval Desk',      sublabel: 'Sanction',     path: '/operations/approved' },
];

export default function WorkflowBar({ activeStage }: { activeStage?: number }) {
  const navigate = useNavigate();
  const { workflowStage, setWorkflowStage, getStageStatus } = usePlanning();

  const current = activeStage ?? workflowStage;

  const handleStepClick = (stage: Stage) => {
    setWorkflowStage(stage.num);
    navigate(stage.path);
  };

  return (
    <div className="bg-white border-b border-border px-4 py-2 flex items-center justify-between text-xs select-none shadow-xs">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] font-mono uppercase tracking-wider text-text-secondary font-bold mr-2 hidden sm:inline">
          Planning Workflow:
        </span>
        {STAGES.map((stage, idx) => {
          const isCurrent = current === stage.num;
          const status = getStageStatus ? getStageStatus(stage.num) : { isComplete: false };
          // ONLY show as done tick-marked if real prerequisites are truly complete
          const isDone = status.isComplete && !isCurrent;
          // If the user has progressed beyond this step, but it is incomplete, do NOT show tick mark!
          const isIncompletePast = current > stage.num && !status.isComplete;

          return (
            <React.Fragment key={stage.num}>
              <button
                onClick={() => handleStepClick(stage)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-all cursor-pointer text-left ${
                  isCurrent
                    ? 'bg-accent text-white font-bold shadow-xs'
                    : isDone
                    ? 'bg-panel text-accent hover:bg-slate-100 font-medium'
                    : isIncompletePast
                    ? 'bg-amber-50/80 text-amber-900 border border-amber-200/80 hover:bg-amber-100 font-medium'
                    : 'text-text-secondary hover:text-text-primary hover:bg-panel'
                }`}
                title={`Step ${stage.num}: ${stage.label} — ${
                  isDone
                    ? 'Completed'
                    : isIncompletePast
                    ? `Incomplete (${status.reason || 'Prerequisites missing'})`
                    : status.reason || 'Pending'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-mono font-bold ${
                    isCurrent
                      ? 'bg-white text-accent'
                      : isDone
                      ? 'bg-emerald-600 text-white'
                      : isIncompletePast
                      ? 'bg-amber-500 text-white'
                      : 'bg-slate-200 text-text-secondary'
                  }`}
                >
                  {isDone ? (
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  ) : isIncompletePast ? (
                    <AlertTriangle className="w-2.5 h-2.5 stroke-[2.5]" />
                  ) : (
                    stage.num
                  )}
                </span>
                <span className="truncate">{stage.label}</span>
                {isIncompletePast && (
                  <span className="text-[9px] px-1 py-0.2 rounded bg-amber-200/70 text-amber-900 font-semibold uppercase tracking-wider hidden md:inline">
                    Incomplete
                  </span>
                )}
              </button>

              {idx < STAGES.length - 1 && (
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              )}
            </React.Fragment>
          );
        })}
      </div>

      <div className="hidden lg:flex items-center gap-2 font-mono text-[11px] text-text-secondary">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        <span>Corridor Window Engine: Active</span>
      </div>
    </div>
  );
}
