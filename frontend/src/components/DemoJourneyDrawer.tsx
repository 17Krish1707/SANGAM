import { useNavigate } from 'react-router-dom';
import { usePlanningContext } from '../context/PlanningContext';
import { X, ChevronRight, Compass } from 'lucide-react';

interface DemoStep {
  step: number;
  title: string;
  path: string;
  duration: string;
  objective: string;
  keyAction: string;
}

const DEMO_STEPS: DemoStep[] = [
  {
    step: 1,
    title: 'Operations Overview',
    path: '/',
    duration: '20s',
    objective: 'Demonstrate demand from Engineering, S&T, and TRD across the 5-section corridor.',
    keyAction: 'Inspect the Hero Impact banner showing 14.4h / 39.1% saved and the full-width corridor track.',
  },
  {
    step: 2,
    title: 'Inspect Critical Task',
    path: '/maintenance/all',
    duration: '25s',
    objective: 'Examine Critical Task ENG-3421 (Weld Repair on Section B-C).',
    keyAction: 'Click task row to open the Task Intelligence Drawer showing 6-factor priority breakdown & compatibility cluster.',
  },
  {
    step: 3,
    title: 'Check Corridor Window',
    path: '/corridor',
    duration: '25s',
    objective: 'Verify train movement headway on Section B–C.',
    keyAction: 'Review the 24-hour occupancy timeline showing passenger & goods trains, safety buffers, and risk score breakdown.',
  },
  {
    step: 4,
    title: 'Planning Workbench (CP-SAT)',
    path: '/planning/workbench',
    duration: '40s',
    objective: 'Generate Balanced Recommended Joint Plan directly on the railway tracks.',
    keyAction: 'Select the joint block on Section B–C. Show why Engineering + S&T + TRD are safely combined.',
  },
  {
    step: 5,
    title: 'Compare Savings (Before vs After)',
    path: '/planning/compare',
    duration: '35s',
    objective: 'Show the winning visual moment: 3 separate department blocks merging into 1 joint possession.',
    keyAction: 'Click "Run SANGAM Coordinated Optimization" and inspect the 3-way table (Independent vs Greedy vs SANGAM).',
  },
  {
    step: 6,
    title: 'Controller Block Approval',
    path: '/approvals',
    duration: '20s',
    objective: 'Demonstrate human-in-the-loop railway operations decision desk.',
    keyAction: 'Click "Approve" on the recommended block to apply the official CONTROLLER APPROVED timestamped stamp.',
  },
  {
    step: 7,
    title: 'Simulate Train Delay (+45m)',
    path: '/planning/replan',
    duration: '30s',
    objective: 'Dynamic re-planning when operational conditions change.',
    keyAction: 'Trigger a 45-minute delay on Section B–C. Watch the train shift, trigger a conflict, and see SANGAM re-plan.',
  },
  {
    step: 8,
    title: 'Data Sources & Transparency',
    path: '/data-sources',
    duration: '15s',
    objective: 'Full transparency regarding Indian Railways TMS/SMMS/TDMS integration & synthetic seed 26027.',
    keyAction: 'Inspect the system pipeline diagram and synthetic prototype notice.',
  },
];

export default function DemoJourneyDrawer() {
  const { isDemoJourneyOpen, setIsDemoJourneyOpen, currentDemoStep, setCurrentDemoStep } = usePlanningContext();
  const navigate = useNavigate();

  if (!isDemoJourneyOpen) return null;

  const handleStepClick = (s: DemoStep) => {
    setCurrentDemoStep(s.step);
    navigate(s.path);
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-96 bg-white border-l border-border shadow-overlay flex flex-col select-none animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between bg-panel">
        <div className="flex items-center gap-2">
          <Compass className="w-5 h-5 text-accent" />
          <div>
            <h3 className="text-sm font-bold text-text-primary">Judge Demo Journey</h3>
            <p className="text-2xs text-text-secondary">2–4 Minute End-to-End Walkthrough</p>
          </div>
        </div>
        <button
          onClick={() => setIsDemoJourneyOpen(false)}
          className="p-1 text-text-secondary hover:text-text-primary rounded-md hover:bg-white transition-colors"
          aria-label="Close demo journey"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Steps List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {DEMO_STEPS.map((s) => {
          const isCurrent = currentDemoStep === s.step;
          const isPast = currentDemoStep > s.step;

          return (
            <div
              key={s.step}
              onClick={() => handleStepClick(s)}
              className={`p-3 rounded-card border transition-all cursor-pointer ${
                isCurrent
                  ? 'border-accent bg-accent-tint/30 shadow-xs ring-1 ring-accent'
                  : isPast
                  ? 'border-emerald-200 bg-emerald-50/30'
                  : 'border-border bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                      isPast
                        ? 'bg-emerald-600 text-white'
                        : isCurrent
                        ? 'bg-accent text-white'
                        : 'bg-slate-200 text-text-secondary'
                    }`}
                  >
                    {isPast ? '✓' : s.step}
                  </span>
                  <span className="text-xs font-bold text-text-primary">{s.title}</span>
                </div>
                <span className="text-2xs font-mono text-text-secondary">{s.duration}</span>
              </div>

              <p className="text-2xs text-text-secondary pl-7">{s.objective}</p>

              {isCurrent && (
                <div className="mt-2.5 pt-2 border-t border-accent/20 pl-7 text-2xs text-accent font-medium">
                  <strong>Action:</strong> {s.keyAction}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Navigation */}
      <div className="p-4 border-t border-border bg-panel flex items-center justify-between">
        <button
          onClick={() => {
            const prev = Math.max(1, currentDemoStep - 1);
            const target = DEMO_STEPS.find((s) => s.step === prev);
            if (target) handleStepClick(target);
          }}
          disabled={currentDemoStep === 1}
          className="px-3 py-1.5 rounded-md border border-border text-xs font-semibold text-text-secondary hover:text-text-primary disabled:opacity-40"
        >
          Previous
        </button>

        <button
          onClick={() => {
            const next = Math.min(DEMO_STEPS.length, currentDemoStep + 1);
            const target = DEMO_STEPS.find((s) => s.step === next);
            if (target) handleStepClick(target);
          }}
          disabled={currentDemoStep === DEMO_STEPS.length}
          className="px-4 py-1.5 rounded-md bg-accent text-white text-xs font-semibold hover:bg-accent-hover disabled:opacity-40 flex items-center gap-1"
        >
          Next Step <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
