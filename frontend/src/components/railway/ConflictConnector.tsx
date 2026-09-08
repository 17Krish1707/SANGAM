
export type RelationshipType = 'compatible' | 'conflict' | 'dependency';

interface ConflictConnectorProps {
  relationship: RelationshipType;
  fromLabel: string;
  toLabel: string;
  notes?: string;
  className?: string;
}

export default function ConflictConnector({
  relationship,
  fromLabel,
  toLabel,
  notes,
  className = '',
}: ConflictConnectorProps) {
  const styles: Record<RelationshipType, { stroke: string; bg: string; text: string; label: string; icon: string }> = {
    compatible: {
      stroke: '#059669',
      bg: 'bg-emerald-50',
      text: 'text-emerald-800',
      label: 'COMPATIBLE (PARALLEL-SAFE)',
      icon: '✓',
    },
    conflict: {
      stroke: '#DC2626',
      bg: 'bg-red-50',
      text: 'text-red-800',
      label: 'SAFETY CONFLICT (MUTEX)',
      icon: '✕',
    },
    dependency: {
      stroke: '#4F46E5',
      bg: 'bg-indigo-50',
      text: 'text-indigo-800',
      label: 'PRECEDENCE DEPENDENCY (A → B)',
      icon: '→',
    },
  };

  const curr = styles[relationship] || styles.compatible;

  return (
    <div className={`p-2.5 rounded-md border border-border flex items-center justify-between text-xs ${curr.bg} ${className}`}>
      <div className="flex items-center gap-2">
        <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-white text-xs`} style={{ backgroundColor: curr.stroke }}>
          {curr.icon}
        </span>
        <div className="font-mono font-semibold text-text-primary">
          <span>{fromLabel}</span>
          <span className="mx-1.5 text-text-secondary">─</span>
          <span>{toLabel}</span>
        </div>
      </div>

      <div className="text-right">
        <span className={`text-2xs font-bold uppercase tracking-wider font-mono ${curr.text}`}>
          {curr.label}
        </span>
        {notes && <p className="text-[10px] text-text-secondary truncate max-w-xs">{notes}</p>}
      </div>
    </div>
  );
}
