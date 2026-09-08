import React from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlanning } from '../context/PlanningContext';
import { ChevronRight, Check } from 'lucide-react';

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
  const { workflowStage, setWorkflowStage } = usePlanning();

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
          const isCompleted = current > stage.num;
          const isCurrent = current === stage.num;

          return (
            <React.Fragment key={stage.num}>
              <button
                onClick={() => handleStepClick(stage)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-all cursor-pointer text-left ${
                  isCurrent
                    ? 'bg-accent text-white font-bold shadow-xs'
                    : isCompleted
                    ? 'bg-panel text-accent hover:bg-slate-100 font-medium'
                    : 'text-text-secondary hover:text-text-primary hover:bg-panel'
                }`}
                title={`Go to Step ${stage.num}: ${stage.label}`}
              >
                <span
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-mono font-bold ${
                    isCurrent
                      ? 'bg-white text-accent'
                      : isCompleted
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 text-text-secondary'
                  }`}
                >
                  {isCompleted ? <Check className="w-2.5 h-2.5 stroke-[3]" /> : stage.num}
                </span>
                <span className="truncate">{stage.label}</span>
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
