
interface OHEMarkerProps {
  isIsolated?: boolean;
  voltageKv?: number;
  label?: string;
  className?: string;
  size?: 'sm' | 'md';
}

export default function OHEMarker({
  isIsolated = false,
  voltageKv = 25,
  label,
  className = '',
  size = 'md',
}: OHEMarkerProps) {
  const isSm = size === 'sm';

  return (
    <div
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-mono font-medium select-none border ${
        isIsolated
          ? 'bg-amber-50 text-amber-800 border-amber-300'
          : 'bg-slate-50 text-slate-700 border-slate-200'
      } ${className}`}
      title={isIsolated ? `OHE ${voltageKv}kV Power Isolated (De-energized)` : `OHE ${voltageKv}kV Live Traction Overhead`}
    >
      {/* Overhead catenary & pantograph glyph */}
      <svg className={`${isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} flex-shrink-0`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 4h16M2 4h20M12 4v4l-4 5h8l-4-5M8 13l-4 7h16l-4-7" />
        {isIsolated && <path d="M6 18l12-12" stroke="#B45309" strokeWidth="2.5" />}
      </svg>

      <span>{label || (isIsolated ? 'OHE ISO' : `${voltageKv}kV`)}</span>
    </div>
  );
}
