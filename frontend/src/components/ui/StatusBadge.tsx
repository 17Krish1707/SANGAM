export type BadgeVariant = 'critical' | 'warning' | 'good' | 'neutral';

interface StatusBadgeProps {
  variant: BadgeVariant;
  label: string;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  critical: 'bg-status-critical-bg text-status-critical-text',
  warning:  'bg-status-warning-bg  text-status-warning-text',
  good:     'bg-status-good-bg     text-status-good-text',
  neutral:  'bg-status-neutral-bg  text-status-neutral-text',
};

export default function StatusBadge({ variant, label, className = '' }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-badge text-xs font-medium leading-none ${variantClasses[variant]} ${className}`}
    >
      {label}
    </span>
  );
}
