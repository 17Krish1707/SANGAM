import { useState, useRef } from 'react';
import {
  type GeneratedBlock,
  type TimetableTrain,
  type Section,
} from '../../lib/apiClient';
import {
  Lock,
  CheckCircle2,
  Clock,
} from 'lucide-react';

interface OperationalGanttTimelineProps {
  sections: Section[];
  blocks: GeneratedBlock[];
  trains?: TimetableTrain[];
  selectedBlockId?: string | null;
  onSelectBlock: (block: GeneratedBlock) => void;
  baseDate?: string; // YYYY-MM-DD
}

export const OperationalGanttTimeline: React.FC<OperationalGanttTimelineProps> = ({
  sections,
  blocks,
  trains = [],
  selectedBlockId,
  onSelectBlock,
  baseDate = '2026-09-08',
}) => {
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [hoveredBlock, setHoveredBlock] = useState<GeneratedBlock | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Time calculations
  const totalHours = viewMode === 'day' ? 24 : 7 * 24;
  const hourWidth = viewMode === 'day' ? 60 : 25; // px per hour
  const totalTimelineWidth = totalHours * hourWidth;

  const getLeftAndWidth = (startStr: string, endStr: string) => {
    const base = new Date(`${baseDate}T00:00:00`).getTime();
    const s = new Date(startStr).getTime();
    const e = new Date(endStr).getTime();

    const startMin = Math.max(0, (s - base) / (1000 * 60));
    const durationMin = Math.max(15, (e - s) / (1000 * 60));

    const leftPx = (startMin / 60) * hourWidth;
    const widthPx = Math.max(32, (durationMin / 60) * hourWidth);

    return { leftPx, widthPx };
  };

  const handleMouseMove = (e: React.MouseEvent, block: GeneratedBlock) => {
    setHoveredBlock(block);
    setTooltipPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseLeave = () => {
    setHoveredBlock(null);
    setTooltipPos(null);
  };

  // Generate hourly ticks
  const hourlyTicks = Array.from({ length: 24 }, (_, i) => i);
  const weekDays = ['Tue 08', 'Wed 09', 'Thu 10', 'Fri 11', 'Sat 12', 'Sun 13', 'Mon 14'];

  return (
    <div className="bg-white border border-[#D9E1EA] rounded-xl shadow-xs overflow-hidden flex flex-col">
      {/* Gantt Controls Bar */}
      <div className="px-5 py-3 border-b border-[#D9E1EA] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F8FAFC]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-[#173F7A]" />
            <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-[#172033]">
              Operational Possession Timeline
            </h3>
          </div>
          <span className="text-[11px] font-mono text-[#667085] bg-white px-2 py-0.5 rounded border border-[#D9E1EA]">
            Base Date: {baseDate}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Day / Week Toggle */}
          <div className="flex items-center bg-[#EBF2FA] p-0.5 rounded-lg text-xs font-semibold">
            <button
              onClick={() => setViewMode('day')}
              className={`px-3 py-1 rounded-md transition-all ${
                viewMode === 'day' ? 'bg-white text-[#173F7A] shadow-xs font-bold' : 'text-[#667085] hover:text-[#172033]'
              }`}
            >
              24-Hour Day View
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1 rounded-md transition-all ${
                viewMode === 'week' ? 'bg-white text-[#173F7A] shadow-xs font-bold' : 'text-[#667085] hover:text-[#172033]'
              }`}
            >
              Weekly Overview
            </button>
          </div>

          {/* Legend */}
          <div className="hidden lg:flex items-center gap-3 text-[11px] font-medium text-[#667085]">
            <span className="flex items-center gap-1">
              <span className="w-3 h-2.5 rounded bg-blue-100 border border-blue-400"></span>
              ENG
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-2.5 rounded bg-amber-100 border border-amber-400"></span>
              TRD
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-2.5 rounded bg-indigo-100 border border-indigo-400"></span>
              S&T
            </span>
            <span className="flex items-center gap-1 font-bold text-[#173F7A]">
              <span className="w-3 h-2.5 rounded bg-gradient-to-r from-blue-200 via-amber-200 to-indigo-200 border-2 border-indigo-500"></span>
              JOINT BLOCK
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-2.5 rounded bg-slate-300/40 border border-dashed border-slate-400"></span>
              Train Path
            </span>
          </div>
        </div>
      </div>

      {/* Gantt Chart Horizontal Scroll Container */}
      <div ref={containerRef} className="overflow-x-auto overflow-y-visible relative select-none">
        <div style={{ width: `${Math.max(850, totalTimelineWidth + 180)}px` }} className="relative">
          {/* Top Sticky Time Scale Header */}
          <div className="flex border-b border-[#D9E1EA] bg-[#F8FAFC] sticky top-0 z-20 text-[11px] font-mono text-[#667085]">
            {/* Left corner pinned header */}
            <div className="w-44 flex-shrink-0 px-4 py-2 border-r border-[#D9E1EA] bg-[#F8FAFC] sticky left-0 z-30 font-bold text-[#172033] uppercase text-[10px] tracking-wider flex items-center justify-between">
              <span>Section / Line</span>
              <span className="text-[9px] text-[#667085]">KM / Trk</span>
            </div>

            {/* Time Ticks */}
            <div className="flex-1 flex relative h-10">
              {viewMode === 'day' ? (
                hourlyTicks.map((h) => (
                  <div
                    key={h}
                    style={{ width: `${hourWidth}px` }}
                    className="flex-shrink-0 border-r border-slate-200 flex flex-col justify-end p-1 text-[10px] font-mono"
                  >
                    <span>{String(h).padStart(2, '0')}:00</span>
                  </div>
                ))
              ) : (
                weekDays.map((day, idx) => (
                  <div
                    key={idx}
                    style={{ width: `${24 * hourWidth}px` }}
                    className="flex-shrink-0 border-r-2 border-slate-300 flex flex-col justify-between p-1 bg-slate-50/70"
                  >
                    <span className="font-bold text-[#172033]">{day}</span>
                    <div className="flex justify-between text-[9px] text-slate-400">
                      <span>00</span>
                      <span>06</span>
                      <span>12</span>
                      <span>18</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Section Rows */}
          <div className="divide-y divide-[#D9E1EA]">
            {sections.length === 0 ? (
              <div className="p-8 text-center text-[#667085] text-xs">
                No sections defined. Configure corridor sections to render possession rows.
              </div>
            ) : (
              sections.map((sec) => {
                const secBlocks = blocks.filter(
                  (b) => b.section_id === sec.id || b.section_name?.includes(sec.name)
                );
                const secTrains = trains.filter(
                  (tr) => tr.section_id === sec.id || tr.section_name?.includes(sec.name)
                );

                return (
                  <div key={sec.id} className="flex relative h-20 group hover:bg-slate-50/50 transition-colors">
                    {/* Sticky Left Column: Section Name */}
                    <div className="w-44 flex-shrink-0 px-4 py-3 border-r border-[#D9E1EA] bg-white sticky left-0 z-10 flex flex-col justify-center shadow-xs">
                      <div className="font-bold text-xs text-[#172033] group-hover:text-[#173F7A] truncate">
                        {sec.name}
                      </div>
                      <div className="text-[10px] text-[#667085] font-mono mt-0.5">
                        {sec.from_station} → {sec.to_station}
                      </div>
                      <div className="text-[9px] text-slate-400 font-mono mt-0.5 flex items-center gap-1.5">
                        <span>{sec.length_km || 25} km</span>
                        <span>•</span>
                        <span className="capitalize">{sec.line_type || 'double'}</span>
                      </div>
                    </div>

                    {/* Timeline Canvas for this Section */}
                    <div className="flex-1 relative overflow-hidden bg-white">
                      {/* Grid background vertical lines */}
                      <div className="absolute inset-0 flex pointer-events-none">
                        {viewMode === 'day'
                          ? hourlyTicks.map((h) => (
                              <div
                                key={h}
                                style={{ width: `${hourWidth}px` }}
                                className="flex-shrink-0 border-r border-slate-100 h-full"
                              />
                            ))
                          : weekDays.map((_, idx) => (
                              <div
                                key={idx}
                                style={{ width: `${24 * hourWidth}px` }}
                                className="flex-shrink-0 border-r-2 border-slate-200 h-full"
                              />
                            ))}
                      </div>

                      {/* Train Occupancy Overlays (Thin translucent tracks) */}
                      {secTrains.map((tr) => {
                        const { leftPx, widthPx } = getLeftAndWidth(tr.entry_time, tr.exit_time);
                        return (
                          <div
                            key={tr.id}
                            style={{
                              left: `${leftPx}px`,
                              width: `${widthPx}px`,
                            }}
                            className="absolute top-1 bottom-1 bg-slate-200/50 border-x border-slate-300 rounded pointer-events-none flex flex-col justify-between p-1 z-0 overflow-hidden"
                            title={`Train ${tr.train_number} (${tr.train_type}): ${new Date(tr.entry_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}–${new Date(tr.exit_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                          >
                            <span className="text-[9px] font-mono font-bold text-slate-600 truncate leading-none">
                              {tr.train_number}
                            </span>
                            <span className="text-[8px] text-slate-500 truncate leading-none">
                              {tr.train_type?.slice(0, 3)}
                            </span>
                          </div>
                        );
                      })}

                      {/* Possession Block Bars */}
                      {secBlocks.map((b) => {
                        const { leftPx, widthPx } = getLeftAndWidth(b.block_start, b.block_end);
                        const isSelected = selectedBlockId === b.id;
                        const isJoint = b.is_joint_block || (b.departments && b.departments.length > 1);
                        const isApproved = b.approval_status === 'approved';
                        const startTime = new Date(b.block_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        const endTime = new Date(b.block_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                        // Palette selection
                        const dept = b.departments?.[0] || 'ENG';
                        let blockStyle = 'bg-blue-100 text-blue-900 border-blue-400';
                        if (isJoint) {
                          blockStyle = 'bg-gradient-to-r from-blue-50 via-amber-50 to-indigo-50 border-2 border-indigo-500 text-[#172033] shadow-sm';
                        } else if (dept === 'TRD') {
                          blockStyle = 'bg-amber-100 text-amber-900 border-amber-400';
                        } else if (dept === 'SNT' || dept === 'SIG') {
                          blockStyle = 'bg-indigo-100 text-indigo-900 border-indigo-400';
                        }

                        return (
                          <div
                            key={b.id}
                            onClick={() => onSelectBlock(b)}
                            onMouseEnter={(e) => handleMouseMove(e, b)}
                            onMouseMove={(e) => handleMouseMove(e, b)}
                            onMouseLeave={handleMouseLeave}
                            style={{
                              left: `${leftPx}px`,
                              width: `${widthPx}px`,
                            }}
                            className={`absolute top-2.5 bottom-2.5 rounded-lg border px-2.5 py-1 cursor-pointer transition-all flex flex-col justify-between z-10 ${blockStyle} ${
                              isSelected ? 'ring-3 ring-[#173F7A] ring-offset-1 scale-[1.02] shadow-md z-20' : 'hover:scale-[1.01]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1 overflow-hidden leading-tight">
                              <div className="flex items-center gap-1 truncate">
                                {isJoint ? (
                                  <span className="px-1 py-0.2 rounded bg-indigo-600 text-white text-[9px] font-black tracking-tight font-mono">
                                    JOINT
                                  </span>
                                ) : (
                                  <span className="px-1 py-0.2 rounded bg-white/80 border border-current text-[9px] font-bold font-mono">
                                    {dept}
                                  </span>
                                )}
                                {widthPx > 80 && (
                                  <span className="text-[10px] font-bold truncate">
                                    {isJoint ? (b.departments?.join(' · ') || 'ENG · TRD · S&T') : b.tasks?.[0]?.task_code || 'Block'}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1 flex-shrink-0">
                                {b.locked && <span title="Locked possession"><Lock className="w-3 h-3 text-[#173F7A]" /></span>}
                                {isApproved && <span title="Approved"><CheckCircle2 className="w-3 h-3 text-emerald-600" /></span>}
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-[10px] font-mono leading-none pt-0.5">
                              {widthPx > 90 ? (
                                <>
                                  <span className="font-semibold">{startTime}–{endTime}</span>
                                  <span className="font-bold opacity-80">{b.duration_min}m</span>
                                </>
                              ) : (
                                <span className="font-bold">{b.duration_min}m</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Interactive Compact Hover Tooltip */}
      {hoveredBlock && tooltipPos && (
        <div
          style={{
            position: 'fixed',
            left: `${Math.min(window.innerWidth - 260, tooltipPos.x + 12)}px`,
            top: `${Math.min(window.innerHeight - 180, tooltipPos.y + 12)}px`,
          }}
          className="z-50 bg-[#172033] text-white p-3 rounded-lg shadow-xl text-xs space-y-1.5 w-60 pointer-events-none border border-slate-700 animate-in fade-in duration-100"
        >
          <div className="flex items-center justify-between pb-1 border-b border-slate-700">
            <span className="font-mono font-bold text-sky-300">
              {hoveredBlock.is_joint_block ? 'JOINT POSSESSION' : 'SINGLE BLOCK'}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono">
              {hoveredBlock.approval_status || 'Recommended'}
            </span>
          </div>

          <div className="font-bold text-sm">
            {hoveredBlock.section_name}
          </div>

          <div className="text-[11px] text-slate-300 font-mono">
            {new Date(hoveredBlock.block_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {new Date(hoveredBlock.block_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({hoveredBlock.duration_min} min)
          </div>

          <div className="text-[10px] text-slate-400">
            <strong>Departments:</strong> {hoveredBlock.departments?.join(', ') || 'ENG'}
          </div>

          <div className="text-[10px] text-slate-400">
            <strong>Tasks Included:</strong> {hoveredBlock.tasks?.length || 0} maintenance jobs
          </div>

          <div className="text-[9px] text-sky-400 pt-1 border-t border-slate-700">
            Click block to open Operational Inspector
          </div>
        </div>
      )}
    </div>
  );
};
