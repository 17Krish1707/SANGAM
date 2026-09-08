
interface StationNodeProps {
  code: string;
  name?: string;
  isJunction?: boolean;
  isActive?: boolean;
  onClick?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function StationNode({
  code,
  name,
  isJunction = false,
  isActive = false,
  onClick,
  className = '',
  size = 'md',
}: StationNodeProps) {
  const sizeClasses = {
    sm: 'w-6 h-6 text-[10px]',
    md: 'w-8 h-8 text-xs',
    lg: 'w-10 h-10 text-sm',
  };

  return (
    <div
      onClick={onClick}
      className={`inline-flex flex-col items-center select-none group ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      <div
        className={`
          ${sizeClasses[size]} rounded-full flex items-center justify-center font-bold tracking-tight
          transition-all duration-150 relative border-2
          ${isActive
            ? 'bg-accent text-white border-accent shadow-sm scale-105'
            : 'bg-white text-text-primary border-slate-400 group-hover:border-accent group-hover:text-accent'}
          ${isJunction ? 'ring-2 ring-offset-1 ring-slate-300' : ''}
        `}
      >
        {code}
        {isJunction && (
          <span
            className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500 border border-white"
            title="Corridor Junction"
          />
        )}
      </div>

      {name && (
        <span
          className={`mt-1 text-2xs font-medium truncate max-w-[80px] text-center ${
            isActive ? 'text-accent font-semibold' : 'text-text-secondary group-hover:text-text-primary'
          }`}
        >
          {name}
        </span>
      )}
    </div>
  );
}
