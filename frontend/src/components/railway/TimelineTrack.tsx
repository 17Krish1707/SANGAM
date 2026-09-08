import React from 'react';

interface TimelineTrackProps {
  sectionName: string;
  className?: string;
  children?: React.ReactNode;
  height?: number;
}

export default function TimelineTrack({
  sectionName,
  className = '',
  children,
  height = 56,
}: TimelineTrackProps) {
  // Hours from 00 to 24 (4-hour primary markers, 1-hour subtle ticks)
  const hours = Array.from({ length: 25 }, (_, i) => i);

  return (
    <div className={`relative border border-border bg-white rounded-md my-2 overflow-hidden shadow-xs ${className}`}>
      {/* Section Identifier Track Header */}
      <div className="flex items-center justify-between px-3 py-1 bg-panel border-b border-border text-2xs font-mono">
        <span className="font-bold text-text-primary">{sectionName}</span>
        <span className="text-text-secondary">Double Line · Auto Signalled</span>
      </div>

      {/* Main Track Timeline Area */}
      <div className="relative w-full overflow-hidden" style={{ height }}>
        {/* Subtle background steel rails */}
        <div className="absolute top-[35%] left-0 right-0 h-[1.5px] bg-slate-300 pointer-events-none" />
        <div className="absolute top-[65%] left-0 right-0 h-[1.5px] bg-slate-300 pointer-events-none" />

        {/* 24-Hour Vertical Grid Lines & Sleepers */}
        <div className="absolute inset-0 flex pointer-events-none">
          {hours.map((h) => (
            <div
              key={h}
              className={`flex-1 border-r ${
                h % 4 === 0 ? 'border-slate-300' : 'border-slate-100'
              } h-full relative`}
            >
              {/* Sleeper tick on rails */}
              <div className="absolute top-[30%] left-1/2 -translate-x-1/2 w-0.5 h-[40%] bg-slate-200" />
            </div>
          ))}
        </div>

        {/* Children (Possession Bands, Trains, Windows) */}
        <div className="relative w-full h-full z-10">
          {children}
        </div>
      </div>
    </div>
  );
}
