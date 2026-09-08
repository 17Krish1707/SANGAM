export type DepartmentCode = 'ENG' | 'TRD' | 'SNT' | string;

interface MaintenanceMarkerProps {
  department: DepartmentCode;
  taskCode?: string;
  severity?: 'Critical' | 'High' | 'Medium' | 'Low' | string;
  priorityScore?: number;
  size?: 'sm' | 'md';
  onClick?: () => void;
  className?: string;
}

export const DEPT_THEMES: Record<string, { label: string; bg: string; text: string; border: string; iconBg: string }> = {
  ENG: { label: 'Engineering', bg: 'bg-blue-50',  text: 'text-blue-800',  border: 'border-blue-200',  iconBg: '#2563EB' },
  TRD: { label: 'Traction',    bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200', iconBg: '#D97706' },
  SNT: { label: 'S&T',         bg: 'bg-indigo-50', text: 'text-indigo-800', border: 'border-indigo-200', iconBg: '#6366F1' },
};

export default function MaintenanceMarker({
  department,
  taskCode,
  severity,
  priorityScore,
  onClick,
  className = '',
}: MaintenanceMarkerProps) {
  const theme = DEPT_THEMES[department] ?? DEPT_THEMES.ENG;
  const isCritical = severity === 'Critical';

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border select-none transition-all duration-100 ${
        theme.bg
      } ${theme.border} ${theme.text} ${onClick ? 'cursor-pointer hover:shadow-xs hover:scale-102' : ''} ${className}`}
      title={`${department} Task ${taskCode ?? ''} | Severity: ${severity ?? '—'}${priorityScore != null ? ` | Priority: ${priorityScore.toFixed(0)}` : ''}`}
    >
      {/* Department vector glyph */}
      <span
        className="w-4 h-4 rounded flex items-center justify-center text-white text-[10px] font-bold"
        style={{ backgroundColor: theme.iconBg }}
      >
        {department[0]}
      </span>

      {taskCode && <span className="font-mono font-semibold tracking-tight">{taskCode}</span>}

      {isCritical && (
        <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" title="Critical Defect" />
      )}

      {priorityScore != null && (
        <span className="tabular-nums opacity-75 font-mono text-2xs">
          {priorityScore.toFixed(0)}
        </span>
      )}
    </div>
  );
}
