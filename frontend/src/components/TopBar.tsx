import { useState } from 'react';
import { ChevronLeft, ChevronRight, Compass } from 'lucide-react';
import { usePlanningContext, DEFAULT_CORRIDOR_NAME } from '../context/PlanningContext';
import RailwaySectionStrip from './railway/RailwaySectionStrip';

interface TopBarProps {
  title: string;
  subtitle?: string;
  showCorridorStrip?: boolean;
}

export default function TopBar({
  title,
  subtitle,
  showCorridorStrip = false,
}: TopBarProps) {
  const {
    selectedHorizon,
    setSelectedHorizon,
    selectedDate,
    setSelectedDate,
    setIsDemoJourneyOpen,
    isGenerating,
  } = usePlanningContext();

  const [date, setDate] = useState(selectedDate);

  const shiftDays = (delta: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    const next = d.toISOString().split('T')[0];
    setDate(next);
    setSelectedDate(next);
  };

  return (
    <div className="flex flex-col flex-shrink-0">
      <header className="h-14 flex-shrink-0 flex items-center justify-between px-6 bg-white border-b border-border select-none">
        {/* Page Title & Operational Context */}
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-sm font-bold text-text-primary leading-tight">{title}</h1>
            {subtitle && (
              <p className="text-[11px] text-text-secondary leading-none mt-0.5 hidden sm:block">
                {subtitle}
              </p>
            )}
          </div>
          <span className="hidden sm:inline-block w-1 h-1 rounded-full bg-slate-300" />
          <span className="hidden sm:inline-block text-2xs font-mono font-medium text-text-secondary">
            Central Division · {DEFAULT_CORRIDOR_NAME}
          </span>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2.5">
          {/* Synthetic Dataset Snapshot Badge */}
          <div
            className="hidden md:inline-flex items-center gap-1.5 px-2 py-1 rounded bg-panel border border-border text-[11px] font-mono text-text-secondary"
            title="Synthetic dataset generated reproducibly with fixed seed=26027"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            <span>SYNTHETIC PROTOTYPE DATA</span>
          </div>

          {/* Optimizer Status Indicator */}
          <div
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-50 border border-emerald-200 text-[11px] font-mono font-semibold text-emerald-800"
            title="Google OR-Tools CP-SAT discrete solver ready"
          >
            <span className={`w-2 h-2 rounded-full ${isGenerating ? 'bg-amber-500 animate-ping' : 'bg-emerald-600'}`} />
            <span>{isGenerating ? 'Solving CP-SAT...' : 'Optimizer Ready'}</span>
          </div>

          {/* Horizon Toggle */}
          <div className="hidden lg:flex items-center border border-border rounded-md overflow-hidden text-xs">
            <button
              onClick={() => setSelectedHorizon('weekly')}
              className={`px-2.5 py-1 font-semibold transition-colors ${
                selectedHorizon === 'weekly'
                  ? 'bg-accent text-white'
                  : 'bg-white text-text-secondary hover:text-text-primary'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setSelectedHorizon('monthly')}
              className={`px-2.5 py-1 font-semibold transition-colors ${
                selectedHorizon === 'monthly'
                  ? 'bg-accent text-white'
                  : 'bg-white text-text-secondary hover:text-text-primary'
              }`}
            >
              Month
            </button>
          </div>

          {/* Date / Week Navigator */}
          <div className="flex items-center border border-border rounded-md overflow-hidden text-xs text-text-secondary">
            <button
              onClick={() => shiftDays(-7)}
              className="px-2 py-1 hover:bg-panel transition-colors"
              aria-label="Previous week"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-3 py-1 border-x border-border font-medium text-text-primary tabular-nums whitespace-nowrap">
              07–13 Sep 2026
            </span>
            <button
              onClick={() => shiftDays(7)}
              className="px-2 py-1 hover:bg-panel transition-colors"
              aria-label="Next week"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Judge Demo Journey button */}
          <button
            onClick={() => setIsDemoJourneyOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-accent text-white hover:bg-accent-hover transition-colors shadow-xs"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Demo Flow</span>
          </button>
        </div>
      </header>

      {/* Optional thin corridor track strip under the top bar */}
      {showCorridorStrip && <RailwaySectionStrip />}
    </div>
  );
}
