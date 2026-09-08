
export type TrackStatus = 'normal' | 'available' | 'planned' | 'joint' | 'warning' | 'conflict';

interface RailwayTrackProps {
  status?: TrackStatus;
  width?: number | string;
  height?: number;
  className?: string;
  showSleepers?: boolean;
  sleeperCount?: number;
  label?: string;
  startStation?: string;
  endStation?: string;
  highlightWindow?: { startPercent: number; endPercent: number; color?: string; label?: string };
}

export const STATUS_COLORS: Record<TrackStatus, { rail: string; sleeper: string; bg: string; text: string }> = {
  normal:    { rail: '#64748B', sleeper: '#CBD5E1', bg: '#F8FAFC', text: '#475467' },
  available: { rail: '#0D9488', sleeper: '#99F6E4', bg: '#F0FDFA', text: '#0F766E' },
  planned:   { rail: '#1E4E8C', sleeper: '#BFDBFE', bg: '#EFF6FF', text: '#1E40AF' },
  joint:     { rail: '#173F7A', sleeper: '#A5B4FC', bg: '#EEF2FF', text: '#1E3A8A' },
  warning:   { rail: '#D97706', sleeper: '#FDE68A', bg: '#FFFBEB', text: '#B45309' },
  conflict:  { rail: '#DC2626', sleeper: '#FECACA', bg: '#FEF2F2', text: '#B91C1C' },
};

export default function RailwayTrack({
  status = 'normal',
  width = '100%',
  height = 36,
  className = '',
  showSleepers = true,
  sleeperCount = 28,
  label,
  startStation,
  endStation,
  highlightWindow,
}: RailwayTrackProps) {
  const colors = STATUS_COLORS[status];
  const sleeperList = Array.from({ length: sleeperCount }, (_, i) => (i + 0.5) * (100 / sleeperCount));

  return (
    <div className={`relative flex flex-col justify-center select-none ${className}`} style={{ width }}>
      {(startStation || endStation || label) && (
        <div className="flex justify-between items-center text-2xs font-semibold text-text-secondary mb-1 px-1">
          <span>{startStation}</span>
          {label && <span className="font-mono text-xs uppercase px-1.5 py-0.2 rounded border border-border bg-white" style={{ color: colors.text }}>{label}</span>}
          <span>{endStation}</span>
        </div>
      )}

      <svg
        viewBox="0 0 100 24"
        preserveAspectRatio="none"
        className="w-full overflow-visible rounded"
        style={{ height }}
        aria-hidden="true"
      >
        {/* Subtle background ballast bed */}
        <rect x="0" y="3" width="100" height="18" fill={colors.bg} rx="2" />

        {/* Sleepers | | | | | */}
        {showSleepers && sleeperList.map((x, idx) => (
          <line
            key={idx}
            x1={x}
            y1="4"
            x2={x}
            y2="20"
            stroke={colors.sleeper}
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        ))}

        {/* Top & Bottom Steel Rails */}
        <line x1="0" y1="7" x2="100" y2="7" stroke={colors.rail} strokeWidth="1.8" strokeLinecap="round" />
        <line x1="0" y1="17" x2="100" y2="17" stroke={colors.rail} strokeWidth="1.8" strokeLinecap="round" />

        {/* Highlight window possession band */}
        {highlightWindow && (
          <g>
            <rect
              x={highlightWindow.startPercent}
              y="5"
              width={Math.max(2, highlightWindow.endPercent - highlightWindow.startPercent)}
              height="14"
              fill={highlightWindow.color || colors.rail}
              fillOpacity="0.85"
              rx="2"
            />
            {highlightWindow.label && (
              <text
                x={(highlightWindow.startPercent + highlightWindow.endPercent) / 2}
                y="14.5"
                fill="#FFFFFF"
                fontSize="6"
                fontWeight="700"
                fontFamily="Inter, system-ui, sans-serif"
                textAnchor="middle"
              >
                {highlightWindow.label}
              </text>
            )}
          </g>
        )}
      </svg>
    </div>
  );
}
