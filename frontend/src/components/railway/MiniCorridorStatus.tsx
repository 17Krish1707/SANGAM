import React from 'react';

interface MiniCorridorStatusProps {
  sectionName?: string;
  activeSectionCode?: string;
  className?: string;
}

export default function MiniCorridorStatus({
  sectionName,
  activeSectionCode = 'B-C',
  className = '',
}: MiniCorridorStatusProps) {
  const sections = ['A-B', 'B-C', 'C-D', 'D-E', 'E-F'];

  return (
    <div className={`inline-flex items-center gap-1 px-2.5 py-1.5 bg-panel border border-border rounded-md select-none text-2xs ${className}`}>
      <span className="font-mono text-text-secondary mr-1">STN A</span>

      {sections.map((s) => {
        const isActive = s === activeSectionCode || (sectionName && sectionName.includes(s));
        return (
          <React.Fragment key={s}>
            <div
              className={`h-1.5 rounded-full transition-all ${
                isActive ? 'w-8 bg-accent shadow-xs' : 'w-4 bg-slate-300'
              }`}
              title={`Section ${s}${isActive ? ' (Target Location)' : ''}`}
            />
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
          </React.Fragment>
        );
      })}

      <span className="font-mono text-text-secondary ml-1">STN F</span>
    </div>
  );
}
