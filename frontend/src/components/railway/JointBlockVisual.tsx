
interface JointBlockVisualProps {
  sectionName?: string;
  timeRange?: string;
  durationMin?: number;
  departments?: { code: string; label: string; tasksCount: number }[];
  savingsMin?: number;
  className?: string;
}

export default function JointBlockVisual({
  sectionName = 'Matunga–Sion',
  timeRange = '01:05 → 02:45',
  durationMin = 100,
  departments = [
    { code: 'ENG', label: 'Engineering', tasksCount: 1 },
    { code: 'TRD', label: 'Traction', tasksCount: 1 },
    { code: 'SNT', label: 'Signalling', tasksCount: 1 },
  ],
  savingsMin = 160,
  className = '',
}: JointBlockVisualProps) {
  return (
    <div className={`p-4 rounded-card border border-accent/30 bg-gradient-to-br from-white to-accent-tint/30 shadow-xs ${className}`}>
      <div className="flex items-center justify-between border-b border-border pb-2.5 mb-3">
        <div>
          <span className="text-2xs uppercase tracking-wider font-bold text-accent">
            OPTIMIZED CO-LOCATION
          </span>
          <h4 className="text-sm font-bold text-text-primary">
            {sectionName} — Coordinated Joint Possession
          </h4>
        </div>
        <div className="text-right">
          <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            +{savingsMin}m SAVED
          </span>
        </div>
      </div>

      {/* 3 Department Blocks -> 1 Coordinated Possession diagram */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {departments.map((d) => (
          <div key={d.code} className="p-2 rounded border border-border bg-white text-center">
            <span className="text-2xs font-bold uppercase tracking-wider text-text-secondary">
              {d.label}
            </span>
            <div className="text-sm font-bold text-text-primary mt-0.5">
              {d.code}
            </div>
            <div className="text-2xs text-text-secondary">
              {d.tasksCount} task assigned
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center text-xs font-semibold text-accent gap-2 py-1 bg-white border border-border rounded">
        <span>3 Siloed Department Demands</span>
        <span>→</span>
        <span className="font-bold text-emerald-700">1 Unified Possession ({durationMin} min)</span>
      </div>

      <div className="mt-2 text-2xs text-text-secondary text-center">
        Corridor gap: {timeRange} · Single high-voltage isolation window · Parallel safety cleared
      </div>
    </div>
  );
}
