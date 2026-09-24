import React from 'react';
import StationNode from './StationNode';
import { usePlanningContext } from '../../context/PlanningContext';

interface ChainageHighlight {
  from_km: number;
  to_km: number;
  label?: string;
  track_line?: string;
}

interface RailwaySectionStripProps {
  className?: string;
  onSectionClick?: (sectionId: string | null) => void;
  highlightChainage?: ChainageHighlight | null;
  activeSectionId?: string | null;
}

export default function RailwaySectionStrip({
  className = '',
  onSectionClick,
  highlightChainage,
  activeSectionId,
}: RailwaySectionStripProps) {
  const { sections, selectedSectionId, setSelectedSectionId } = usePlanningContext();

  const currentSecId = activeSectionId !== undefined ? activeSectionId : selectedSectionId;

  const handleSelect = (id: string | null) => {
    setSelectedSectionId(id);
    onSectionClick?.(id);
  };

  if (sections.length === 0) {
    return (
      <div className={`bg-white border-b border-[#D9E1EA] px-6 py-2.5 flex items-center justify-between text-xs text-[#5A6E85] ${className}`}>
        <span className="italic">No corridor sections configured in active database</span>
        <div className="flex items-center gap-2 text-[11px] font-mono text-[#5A6E85]">
          <span className="w-2 h-2 rounded-full bg-slate-300" />
          <span>Corridor: No Active Sections</span>
        </div>
      </div>
    );
  }

  const selectedSecObj = sections.find((s) => s.id === currentSecId);

  return (
    <div className={`bg-white border-b border-[#D9E1EA] px-5 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 overflow-x-auto select-none shadow-xs ${className}`}>
      {/* Controls & Quick Filter */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={() => handleSelect(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border ${
            currentSecId === null
              ? 'bg-[#173F7A] text-white border-[#173F7A] shadow-xs'
              : 'bg-[#F6F8FB] text-[#3B4D66] border-[#D9E1EA] hover:bg-[#EDF2F7]'
          }`}
        >
          All Corridor Sections
        </button>

        {selectedSecObj && (
          <div className="hidden sm:flex items-center gap-2 text-xs bg-[#EBF3FC] text-[#173F7A] px-2.5 py-1 rounded-md border border-[#CCE0F8] font-medium">
            <span className="font-bold">{selectedSecObj.name}</span>
            <span className="text-[#5A6E85]">•</span>
            <span>{selectedSecObj.length_km ? `${selectedSecObj.length_km} km` : '35 km'}</span>
            <span className="text-[#5A6E85]">•</span>
            <span className="uppercase text-[10px] tracking-wider px-1.5 py-0.5 rounded bg-white text-[#173F7A] font-bold">
              {selectedSecObj.line_type || 'Double'}
            </span>
          </div>
        )}

        {highlightChainage && (
          <div className="flex items-center gap-1.5 text-xs bg-amber-50 text-amber-900 border border-amber-300 px-2.5 py-1 rounded-md font-mono">
            <span className="font-bold">KM {highlightChainage.from_km.toFixed(1)} – {highlightChainage.to_km.toFixed(1)}</span>
            {highlightChainage.track_line && (
              <span className="text-[10px] bg-amber-200 text-amber-950 font-bold px-1.5 py-0.2 rounded uppercase">
                {highlightChainage.track_line}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Schematic Corridor Track Strip */}
      <div className="flex items-center flex-1 max-w-4xl justify-between px-2 min-w-[500px]">
        {sections.map((sec, idx) => {
          const isSelected = currentSecId === sec.id;
          const fromCode = (sec.from_station || 'STN').replace('Station ', '').trim();
          const toCode = (sec.to_station || 'STN').replace('Station ', '').trim();
          const lengthKm = sec.length_km || 30.0;

          // Compute sub-segment highlight position if active
          let hasSubSegment = false;
          let subLeftPct = 0;
          let subWidthPct = 0;

          if (isSelected && highlightChainage && highlightChainage.to_km > highlightChainage.from_km) {
            hasSubSegment = true;
            const fromRel = Math.max(0, highlightChainage.from_km);
            const toRel = Math.min(lengthKm, highlightChainage.to_km);
            subLeftPct = (fromRel / lengthKm) * 100;
            subWidthPct = Math.max(5, ((toRel - fromRel) / lengthKm) * 100);
          }

          return (
            <React.Fragment key={sec.id}>
              {/* Start Station Node on first item */}
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
                type="button"
                onClick={() => handleSelect(isSelected ? null : sec.id)}
                className="flex-1 mx-2 relative flex flex-col items-center group focus:outline-none cursor-pointer"
                title={`${sec.name} (${lengthKm} km, ${sec.line_type || 'Double'}) - Click to toggle focus`}
              >
                {/* Section title & distance chip */}
                <div
                  className={`text-[10px] font-mono tracking-wider px-2 py-0.5 rounded transition-all mb-1.5 flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-[#173F7A] text-white font-bold shadow-xs'
                      : 'bg-[#F6F8FB] text-[#5A6E85] group-hover:text-[#172033] border border-[#D9E1EA]'
                  }`}
                >
                  <span>{sec.name.replace('Section ', '')}</span>
                  <span className="opacity-75">({lengthKm}km)</span>
                </div>

                {/* Track schematic visualization with rails and sleepers */}
                <div className="w-full relative h-4 flex items-center">
                  {/* Track base */}
                  <div
                    className={`w-full h-2 rounded-full transition-all ${
                      isSelected
                        ? 'bg-[#173F7A]/80 shadow-inner'
                        : 'bg-slate-200 group-hover:bg-slate-300'
                    }`}
                  />

                  {/* Sleepers */}
                  <div className="absolute inset-0 flex justify-around items-center px-1 pointer-events-none">
                    <span className="w-0.5 h-3.5 bg-white/80 rounded-xs" />
                    <span className="w-0.5 h-3.5 bg-white/80 rounded-xs" />
                    <span className="w-0.5 h-3.5 bg-white/80 rounded-xs" />
                    <span className="w-0.5 h-3.5 bg-white/80 rounded-xs" />
                    <span className="w-0.5 h-3.5 bg-white/80 rounded-xs" />
                  </div>

                  {/* Highlighted Chainage Sub-segment on this section */}
                  {hasSubSegment && (
                    <div
                      className="absolute top-0 bottom-0 bg-amber-400 border border-amber-600 rounded-xs flex items-center justify-center shadow-xs animate-pulse"
                      style={{
                        left: `${subLeftPct}%`,
                        width: `${subWidthPct}%`,
                      }}
                      title={`Active Work Zone: KM ${highlightChainage?.from_km} – ${highlightChainage?.to_km}`}
                    >
                      <span className="text-[8px] font-bold text-amber-950 font-mono">
                        {highlightChainage?.label || 'ZONE'}
                      </span>
                    </div>
                  )}
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

      {/* Corridor Summary Badge */}
      <div className="hidden xl:flex items-center gap-2 pl-4 text-xs font-mono text-[#5A6E85] border-l border-[#D9E1EA] whitespace-nowrap">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-[#172033] font-medium">Corridor Availability: Feasible</span>
      </div>
    </div>
  );
}
