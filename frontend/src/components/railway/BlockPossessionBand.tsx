import { DEPT_THEMES } from './MaintenanceMarker';

interface BlockPossessionBandProps {
  id?: string;
  startTime: string;
  endTime: string;
  durationMin: number;
  isJointBlock?: boolean;
  departments?: string[];
  tasksCount?: number;
  approvalStatus?: string;
  locked?: boolean;
  onClick?: () => void;
  isSelected?: boolean;
  className?: string;
}

export default function BlockPossessionBand({
  startTime,
  endTime,
  durationMin,
  isJointBlock = false,
  departments = ['ENG'],
  tasksCount = 1,
  approvalStatus = 'recommended',
  locked = false,
  onClick,
  isSelected = false,
  className = '',
}: BlockPossessionBandProps) {
  const isApproved = approvalStatus === 'approved';

  return (
    <div
      onClick={onClick}
      className={`relative inline-flex flex-col justify-center px-3 py-1.5 rounded-md border select-none transition-all duration-150 ${
        isJointBlock
          ? 'bg-gradient-to-r from-blue-50/90 via-indigo-50/90 to-amber-50/90 border-blue-300 shadow-xs'
          : 'bg-white border-border shadow-xs'
      } ${isSelected ? 'ring-2 ring-accent border-accent scale-[1.01]' : 'hover:border-slate-400'} ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
    >
      {/* Top Header: Time Interval & Duration */}
      <div className="flex items-center justify-between gap-2 text-xs font-semibold tabular-nums text-text-primary">
        <span>{startTime.slice(11, 16)} → {endTime.slice(11, 16)}</span>
        <span className="text-2xs font-mono font-normal text-text-secondary bg-slate-100 px-1.5 py-0.5 rounded">
          {durationMin}m
        </span>
      </div>

      {/* Middle: Department color stripes & Joint Block Indicator */}
      <div className="flex items-center gap-1.5 mt-1">
        {departments.map((dept) => {
          const theme = DEPT_THEMES[dept] ?? DEPT_THEMES.ENG;
          return (
            <span
              key={dept}
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold tracking-tight text-white shadow-xs`}
              style={{ backgroundColor: theme.iconBg }}
            >
              {dept}
            </span>
          );
        })}

        {isJointBlock && (
          <span className="text-[10px] font-bold text-accent tracking-wider uppercase bg-accent-tint px-1 rounded border border-accent/20">
            JOINT POSSESSION
          </span>
        )}

        {isApproved && (
          <span className="ml-auto text-[9px] font-bold text-emerald-800 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-300">
            ✓ APPROVED
          </span>
        )}

        {locked && (
          <span className="text-2xs" title="Window Locked">
            🔒
          </span>
        )}
      </div>

      {/* Task count summary */}
      <div className="text-[10px] text-text-secondary mt-0.5">
        {tasksCount} maintenance {tasksCount === 1 ? 'task' : 'tasks'} scheduled
      </div>
    </div>
  );
}
