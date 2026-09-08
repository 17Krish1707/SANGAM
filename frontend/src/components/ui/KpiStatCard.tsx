import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

type TrendDirection = 'up' | 'down' | 'flat';

interface KpiStatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: {
    direction: TrendDirection;
    label: string;
  };
  loading?: boolean;
  className?: string;
}

const TrendIcon = ({ direction }: { direction: TrendDirection }) => {
  if (direction === 'up')   return <TrendingUp  className="w-3.5 h-3.5 text-status-good-text"     aria-hidden />;
  if (direction === 'down') return <TrendingDown className="w-3.5 h-3.5 text-status-critical-text" aria-hidden />;
  return                           <Minus        className="w-3.5 h-3.5 text-text-secondary"       aria-hidden />;
};

export default function KpiStatCard({
  label,
  value,
  unit,
  trend,
  loading = false,
  className = '',
}: KpiStatCardProps) {
  return (
    <div
      className={`bg-white border border-border rounded-card px-5 py-4 flex flex-col gap-1.5 min-w-0 ${className}`}
    >
      <span className="text-xs font-medium text-text-secondary uppercase tracking-wide truncate">
        {label}
      </span>

      {loading ? (
        <div className="h-8 w-24 bg-panel rounded animate-pulse" />
      ) : (
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-text-primary tabular-nums leading-none">
            {value}
          </span>
          {unit && (
            <span className="text-sm font-medium text-text-secondary">{unit}</span>
          )}
        </div>
      )}

      {trend && !loading && (
        <div className="flex items-center gap-1">
          <TrendIcon direction={trend.direction} />
          <span className="text-2xs text-text-secondary">{trend.label}</span>
        </div>
      )}
    </div>
  );
}
