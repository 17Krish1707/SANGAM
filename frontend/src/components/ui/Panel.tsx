import React from 'react';

interface PanelProps {
  children: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
  action?: React.ReactNode;
}

export default function Panel({ children, className = '', title, action }: PanelProps) {
  return (
    <div className={`bg-white border border-border rounded-card ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          {title && (
            <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
          )}
          {action && <div className="ml-auto">{action}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}
