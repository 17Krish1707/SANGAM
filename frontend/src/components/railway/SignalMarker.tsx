
export type SignalAspect = 'red' | 'yellow' | 'double_yellow' | 'green';

interface SignalMarkerProps {
  aspect?: SignalAspect;
  label?: string;
  className?: string;
  size?: 'sm' | 'md';
}

export default function SignalMarker({
  aspect = 'green',
  label,
  className = '',
  size = 'md',
}: SignalMarkerProps) {
  const isSm = size === 'sm';

  const aspectColors: Record<SignalAspect, { color: string; bg: string; text: string }> = {
    red:           { color: '#EF4444', bg: '#FEE2E2', text: 'Danger / Stop' },
    yellow:        { color: '#F59E0B', bg: '#FEF3C7', text: 'Caution' },
    double_yellow: { color: '#EAB308', bg: '#FEF9C3', text: 'Attention' },
    green:         { color: '#10B981', bg: '#D1FAE5', text: 'Proceed' },
  };

  const curr = aspectColors[aspect];

  return (
    <div className={`inline-flex items-center gap-1.5 select-none ${className}`} title={`Signal: ${curr.text}`}>
      {/* 3-aspect / 4-aspect signal post */}
      <div className={`bg-slate-900 rounded-full border border-slate-700 flex items-center justify-center ${isSm ? 'w-3.5 h-3.5' : 'w-5 h-5'}`}>
        <div
          className="rounded-full shadow-inner"
          style={{
            backgroundColor: curr.color,
            width: isSm ? '6px' : '10px',
            height: isSm ? '6px' : '10px',
            boxShadow: `0 0 6px ${curr.color}`,
          }}
        />
      </div>

      {label && (
        <span className="text-2xs font-mono text-text-secondary uppercase">
          {label}
        </span>
      )}
    </div>
  );
}
