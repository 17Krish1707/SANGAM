/**
 * RunToggle — compact pill-style switcher between the three run types.
 * Shown on WeeklyPlan and GanttView so users can compare plans directly.
 */

export type RunType = 'sangam_optimized' | 'independent_baseline' | 'greedy_baseline';

const LABELS: Record<RunType, string> = {
  sangam_optimized:     'SANGAM Optimized',
  independent_baseline: 'Independent Baseline',
  greedy_baseline:      'Greedy Baseline',
};

interface RunToggleProps {
  runIds: Record<RunType, string | null>;
  selected: RunType;
  onChange: (t: RunType) => void;
}

export default function RunToggle({ runIds, selected, onChange }: RunToggleProps) {
  const types: RunType[] = ['sangam_optimized', 'independent_baseline', 'greedy_baseline'];

  return (
    <div className="flex items-center gap-1 p-1 bg-white border border-border rounded-card">
      {types.map((t) => {
        const available = !!runIds[t];
        return (
          <button
            key={t}
            onClick={() => available && onChange(t)}
            disabled={!available}
            title={available ? undefined : 'No run available — generate a plan first'}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors duration-100
              ${selected === t && available
                ? 'bg-accent text-white'
                : available
                  ? 'text-text-secondary hover:text-text-primary hover:bg-panel'
                  : 'text-border cursor-not-allowed'}`}
          >
            {LABELS[t]}
          </button>
        );
      })}
    </div>
  );
}
