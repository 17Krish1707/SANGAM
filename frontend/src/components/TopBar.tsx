import { ChevronLeft, ChevronRight } from 'lucide-react';
import { usePlanningContext, DEFAULT_CORRIDOR_NAME } from '../context/PlanningContext';
import RailwaySectionStrip from './railway/RailwaySectionStrip';

interface TopBarProps {
  title?: string;
  subtitle?: string;
  showCorridorStrip?: boolean;
}

export default function TopBar({
  title = 'SANGAM Operations Workstation',
  subtitle,
  showCorridorStrip = true,
}: TopBarProps) {
  const {
    userRole,
    setUserRole,
    selectedHorizon,
    setSelectedHorizon,
    selectedDate,
    planningWeekStart,
    planningWeekEnd,
    shiftPlanningWeek,
    setPlanningDate,
    isGenerating,
  } = usePlanningContext();

  const startObj = new Date(planningWeekStart);
  const endObj = new Date(planningWeekEnd);
  const startDay = startObj.getDate().toString().padStart(2, '0');
  const endDay = endObj.getDate().toString().padStart(2, '0');
  const monthName = endObj.toLocaleDateString('en-GB', { month: 'short' });
  const year = endObj.getFullYear();
  const weekLabel = `${startDay}–${endDay} ${monthName} ${year}`;


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
          {/* Active User Role Switcher */}
          <div className="flex items-center border border-border rounded-md overflow-hidden text-xs" title="Switch operational perspective">
            <button
              onClick={() => setUserRole('Planner')}
              className={`px-2.5 py-1 font-semibold transition-colors ${
                userRole === 'Planner'
                  ? 'bg-blue-700 text-white'
                  : 'bg-white text-text-secondary hover:text-text-primary'
              }`}
            >
              Planner
            </button>
            <button
              onClick={() => setUserRole('Controller')}
              className={`px-2.5 py-1 font-semibold transition-colors ${
                userRole === 'Controller'
                  ? 'bg-emerald-700 text-white'
                  : 'bg-white text-text-secondary hover:text-text-primary'
              }`}
            >
              Controller
            </button>
          </div>

          {/* Optimizer Status Indicator */}
          <div
            className="hidden sm:inline-flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-50 border border-emerald-200 text-[11px] font-mono font-semibold text-emerald-800"
            title="Optimization Engine: Google OR-Tools CP-SAT"
          >
            <span className={`w-2 h-2 rounded-full ${isGenerating ? 'bg-amber-500 animate-ping' : 'bg-emerald-600'}`} />
            <span>{isGenerating ? 'Optimizing...' : 'Engine Ready'}</span>
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
          <div className="flex items-center border border-border rounded-md overflow-hidden text-xs text-text-secondary bg-white shadow-xs">
            <button
              onClick={() => shiftPlanningWeek(-1)}
              className="px-2 py-1 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Previous planning week"
              aria-label="Previous week"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <label className="relative px-2.5 py-1 border-x border-border font-medium text-text-primary tabular-nums whitespace-nowrap cursor-pointer hover:bg-slate-50 flex items-center gap-1.5" title="Click to pick a specific operating date">
              <span>{weekLabel}</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => e.target.value && setPlanningDate(e.target.value)}
                className="opacity-0 w-0 h-0 absolute pointer-events-auto cursor-pointer"
              />
            </label>
            <button
              onClick={() => shiftPlanningWeek(1)}
              className="px-2 py-1 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Next planning week"
              aria-label="Next week"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Live Operational Status */}
          <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Active Corridor</span>
          </div>
        </div>
      </header>

      {/* Optional thin corridor track strip under the top bar */}
      {showCorridorStrip && <RailwaySectionStrip />}
    </div>
  );
}
