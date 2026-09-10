import React from 'react';
import StationNode from './StationNode';
import { usePlanningContext } from '../../context/PlanningContext';

interface RailwaySectionStripProps {
  className?: string;
  onSectionClick?: (sectionId: string | null) => void;
}

export default function RailwaySectionStrip({
  className = '',
  onSectionClick,
}: RailwaySectionStripProps) {
  const { sections, selectedSectionId, setSelectedSectionId } = usePlanningContext();

  const handleSelect = (id: string | null) => {
    setSelectedSectionId(id);
    onSectionClick?.(id);
  };

  if (sections.length === 0) {
    return (
      <div className={`bg-white border-b border-border px-6 py-2.5 flex items-center justify-between text-xs text-text-secondary ${className}`}>
        <span className="italic">No corridor sections configured in active database</span>
        <div className="flex items-center gap-2 text-2xs font-mono text-text-secondary">
          <span className="w-2 h-2 rounded-full bg-slate-300" />
          <span>Corridor: No Active Sections</span>
        </div>
      </div>
    );
  }

  const displaySections = sections;

  return (
    <div className={`bg-white border-b border-border px-6 py-2 flex items-center justify-between overflow-x-auto select-none ${className}`}>
      {/* "All Sections" filter button */}
      <button
        onClick={() => handleSelect(null)}
        className={`px-2.5 py-1 rounded text-xs font-semibold whitespace-nowrap transition-colors mr-4 border ${
          selectedSectionId === null
            ? 'bg-accent text-white border-accent'
            : 'bg-panel text-text-secondary border-border hover:text-text-primary'
        }`}
      >
        Entire Corridor
      </button>

      {/* Schematic corridor strip */}
      <div className="flex items-center flex-1 max-w-4xl justify-between px-2">
        {displaySections.map((sec, idx) => {
          const isSelected = selectedSectionId === sec.id;
          const fromCode = sec.from_station.replace('Station ', '').trim();
          const toCode = sec.to_station.replace('Station ', '').trim();

          return (
            <React.Fragment key={sec.id}>
              {/* Start Station Node (only render on first item or each transition) */}
              {idx === 0 && (
                <StationNode
                  code={fromCode}
                  name={sec.from_station}
                  size="sm"
                  isActive={isSelected}
                />
              )}

              {/* Interactive track segment between stations */}
              <button
                onClick={() => handleSelect(isSelected ? null : sec.id)}
                className={`flex-1 mx-2 relative flex flex-col items-center group focus:outline-none`}
                title={`${sec.name}: Click to focus section`}
              >
                {/* Section title chip */}
                <span
                  className={`text-[10px] font-mono tracking-wider px-1.5 py-0.5 rounded transition-colors mb-1 ${
                    isSelected
                      ? 'bg-accent text-white font-bold'
                      : 'bg-panel text-text-secondary group-hover:text-text-primary border border-border'
                  }`}
                >
                  {sec.name.replace('Section ', '')}
                </span>

                {/* Vector track segment */}
                <div className="w-full relative h-3 flex items-center">
                  <div
                    className={`w-full h-1.5 rounded-full transition-all ${
                      isSelected
                        ? 'bg-accent shadow-xs'
                        : 'bg-slate-300 group-hover:bg-slate-400'
                    }`}
                  />
                  {/* Subtle track sleepers */}
                  <div className="absolute inset-0 flex justify-around items-center px-1 pointer-events-none">
                    <span className="w-0.5 h-3 bg-white/70" />
                    <span className="w-0.5 h-3 bg-white/70" />
                    <span className="w-0.5 h-3 bg-white/70" />
                  </div>
                </div>
              </button>

              {/* End Station Node */}
              <StationNode
                code={toCode}
                name={sec.to_station}
                size="sm"
                isActive={isSelected}
              />
            </React.Fragment>
          );
        })}
      </div>

      {/* Corridor health summary status */}
      <div className="hidden lg:flex items-center gap-2 pl-4 text-2xs font-mono text-text-secondary border-l border-border whitespace-nowrap">
        <span className="w-2 h-2 rounded-full bg-emerald-500" />
        <span>Corridor Headway: Clear</span>
      </div>
    </div>
  );
}
