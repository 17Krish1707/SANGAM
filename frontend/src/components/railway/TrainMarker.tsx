
interface TrainMarkerProps {
  type: 'Passenger' | 'Goods';
  trainNumber?: string;
  direction?: 'up' | 'down';
  priority?: number;
  confidence?: number | null;
  className?: string;
  showLabel?: boolean;
}

export default function TrainMarker({
  type,
  trainNumber,
  direction = 'up',
  priority = 1,
  confidence,
  className = '',
  showLabel = true,
}: TrainMarkerProps) {
  const isPassenger = type === 'Passenger';
  const badgeBg = isPassenger ? 'bg-blue-600' : 'bg-slate-700';
  const label = trainNumber || (isPassenger ? 'PAX-EXP' : 'FREIGHT');

  return (
    <div
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-mono font-medium text-white shadow-xs select-none ${badgeBg} ${className}`}
      title={`${type} Train ${trainNumber ?? ''} | Priority: ${priority}${
        confidence ? ` | Forecast: ${(confidence * 100).toFixed(0)}%` : ''
      }`}
    >
      {/* Technical Locomotive Silhouette SVG */}
      <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        {isPassenger ? (
          // Aerodynamic passenger locomotive glyph
          <path d="M4 15V8a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v7M4 15h16M4 15v3a1 1 0 0 0 1 1h2M20 15v3a1 1 0 0 1-1 1h-2M8 19h8M8 8h8M7 12h2M15 12h2" />
        ) : (
          // Heavy freight electric/diesel locomotive glyph
          <path d="M3 15V7a2 2 0 0 1 2-2h12l4 5v5M3 15h18M3 15v3a1 1 0 0 0 1 1h2M21 15v3a1 1 0 0 1-1 1h-2M7 19h10M6 8h6M6 11h6" />
        )}
      </svg>

      {showLabel && <span className="tabular-nums font-semibold tracking-tight">{label}</span>}

      {/* Direction indicator */}
      <span className="text-[9px] opacity-75 font-sans">
        {direction === 'up' ? '▲' : '▼'}
      </span>
    </div>
  );
}
