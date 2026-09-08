import { usePlanningContext } from '../../context/PlanningContext';
import StationNode from './StationNode';
import RailwayTrack, { type TrackStatus } from './RailwayTrack';

interface SectionOperationalStatus {
  sectionId: string;
  name: string;
  availableMinutes: number;
  trainDensity: 'Low' | 'Moderate' | 'High';
  riskScore: number;
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH';
  blocksCount: number;
  criticalTasksCount: number;
}

interface CorridorDiagramProps {
  onSelectSection?: (sectionId: string) => void;
  className?: string;
  statuses?: Record<string, Partial<SectionOperationalStatus>>;
}

export default function CorridorDiagram({
  onSelectSection,
  className = '',
  statuses = {},
}: CorridorDiagramProps) {
  const { sections, selectedSectionId, setSelectedSectionId } = usePlanningContext();

  const handleSectionClick = (secId: string) => {
    setSelectedSectionId(secId);
    onSelectSection?.(secId);
  };

  const defaultSections = sections.length > 0 ? sections : [
    { id: 'sec-1', name: 'Section A-B', from_station: 'Station A', to_station: 'Station B' },
    { id: 'sec-2', name: 'Section B-C', from_station: 'Station B', to_station: 'Station C' },
    { id: 'sec-3', name: 'Section C-D', from_station: 'Station C', to_station: 'Station D' },
    { id: 'sec-4', name: 'Section D-E', from_station: 'Station D', to_station: 'Station E' },
    { id: 'sec-5', name: 'Section E-F', from_station: 'Station E', to_station: 'Station F' },
  ];

  return (
    <div className={`bg-white border border-border rounded-card p-4 shadow-xs ${className}`}>
      <div className="flex items-center justify-between mb-4 border-b border-border pb-3">
        <div>
          <span className="text-2xs font-mono font-bold text-accent uppercase tracking-wider">
            TRUNK CORRIDOR SCHEMATIC (DOUBLE LINE 130 KMPH)
          </span>
          <h3 className="text-sm font-bold text-text-primary mt-0.5">
            Today's 5-Section Operational Possession & Headway Picture
          </h3>
        </div>
        <div className="flex items-center gap-3 text-2xs font-mono text-text-secondary">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-emerald-500" /> Safe Window
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-accent" /> Planned Block
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-amber-500" /> Peak Congestion
          </span>
        </div>
      </div>

      {/* Corridor Diagram Grid */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {defaultSections.map((sec, idx) => {
          const isSelected = selectedSectionId === sec.id;
          const fromCode = sec.from_station.replace('Station ', '').trim();
          const toCode = sec.to_station.replace('Station ', '').trim();

          const secStatus = statuses[sec.id] || {
            availableMinutes: 165 - idx * 15,
            riskLevel: idx % 2 === 0 ? 'LOW' : 'MODERATE',
            blocksCount: idx === 1 ? 2 : 1,
            criticalTasksCount: idx === 1 ? 2 : (idx === 0 ? 1 : 0),
          };

          const trackStatus: TrackStatus =
            isSelected ? 'joint' : (secStatus.riskLevel === 'HIGH' ? 'conflict' : (secStatus.blocksCount ? 'planned' : 'available'));

          return (
            <div
              key={sec.id}
              onClick={() => handleSectionClick(sec.id)}
              className={`p-3 rounded-card border transition-all cursor-pointer select-none flex flex-col justify-between ${
                isSelected
                  ? 'border-accent bg-accent-tint/30 shadow-xs ring-1 ring-accent'
                  : 'border-border bg-panel hover:border-slate-300 hover:bg-white'
              }`}
            >
              {/* Station header nodes */}
              <div className="flex items-center justify-between mb-2">
                <StationNode code={fromCode} name={sec.from_station} size="sm" isActive={isSelected} />
                <span className="text-[10px] font-mono text-text-secondary font-bold">
                  {sec.name.replace('Section ', '')}
                </span>
                <StationNode code={toCode} name={sec.to_station} size="sm" isActive={isSelected} />
              </div>

              {/* Technical Railway Track representation */}
              <div className="my-2">
                <RailwayTrack
                  status={trackStatus}
                  height={22}
                  sleeperCount={16}
                  highlightWindow={
                    secStatus.blocksCount
                      ? { startPercent: 30, endPercent: 75, label: `${secStatus.blocksCount} BLK` }
                      : undefined
                  }
                />
              </div>

              {/* Section Operational Metrics */}
              <div className="space-y-1 pt-2 border-t border-border/70 text-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary font-medium">Available Gap:</span>
                  <span className="font-mono font-bold text-text-primary tabular-nums">
                    {secStatus.availableMinutes ?? 120} min
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-text-secondary font-medium">Headway Risk:</span>
                  <span
                    className={`font-mono font-bold px-1 rounded text-[10px] ${
                      secStatus.riskLevel === 'LOW'
                        ? 'text-emerald-700 bg-emerald-50'
                        : secStatus.riskLevel === 'MODERATE'
                        ? 'text-amber-700 bg-amber-50'
                        : 'text-red-700 bg-red-50'
                    }`}
                  >
                    {secStatus.riskLevel ?? 'LOW'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-text-secondary font-medium">Blocks Planned:</span>
                  <span className="font-bold text-accent tabular-nums">
                    {secStatus.blocksCount ?? 1}
                  </span>
                </div>

                {secStatus.criticalTasksCount != null && secStatus.criticalTasksCount > 0 && (
                  <div className="text-[10px] text-red-700 font-semibold bg-red-50 px-1 py-0.5 rounded text-center border border-red-200 mt-1">
                    ⚠ {secStatus.criticalTasksCount} Critical Defect{secStatus.criticalTasksCount > 1 ? 's' : ''}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
