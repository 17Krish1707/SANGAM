import React, { useState, useRef } from 'react';
import {
  type GeneratedBlock,
  type TimetableTrain,
  type Section,
} from '../../lib/apiClient';
import {
  Lock,
  CheckCircle2,
  Clock,
  Train as TrainIcon,
  AlertTriangle,
  ShieldAlert,
} from 'lucide-react';

interface OperationalGanttTimelineProps {
  sections: Section[];
  blocks: GeneratedBlock[];
  trains?: TimetableTrain[];
  selectedBlockId?: string | null;
  onSelectBlock: (block: GeneratedBlock) => void;
  baseDate?: string; // YYYY-MM-DD
}

interface TrainHoverInfo {
  train: TimetableTrain;
  x: number;
  y: number;
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
  const [hoveredTrain, setHoveredTrain] = useState<TrainHoverInfo | null>(null);
  const [blockTooltipPos, setBlockTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Time calculations
  const totalHours = viewMode === 'day' ? 24 : 7 * 24;
  const hourWidth = viewMode === 'day' ? 65 : 25; // px per hour
  const totalTimelineWidth = totalHours * hourWidth;

  const getLeftAndWidth = (startStr: string, endStr: string) => {
    const base = new Date(`${baseDate}T00:00:00`).getTime();
    const s = new Date(startStr).getTime();
    const e = new Date(endStr).getTime();

    const startMin = Math.max(0, (s - base) / (1000 * 60));
    const durationMin = Math.max(5, (e - s) / (1000 * 60));

    const leftPx = (startMin / 60) * hourWidth;
    const widthPx = Math.max(16, (durationMin / 60) * hourWidth);

    return { leftPx, widthPx, s, e };
  };

  // Generate hourly ticks
  const hourlyTicks = Array.from({ length: 24 }, (_, i) => i);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${baseDate}T00:00:00`);
    d.setDate(d.getDate() + i);
    const dayStr = d.toLocaleDateString('en-GB', { weekday: 'short' });
    const numStr = d.getDate().toString().padStart(2, '0');
    return `${dayStr} ${numStr}`;
  });

  // Global Conflict calculation across all visible sections
  const conflicts: Array<{
    train: TimetableTrain;
    block: GeneratedBlock;
    sectionName: string;
    overlapStart: string;
    overlapEnd: string;
  }> = [];

  sections.forEach((sec) => {
    const secBlocks = blocks.filter(
      (b) => b.section_id === sec.id || b.section_name?.includes(sec.name)
    );
    const secTrains = trains.filter(
      (tr) => tr.section_id === sec.id || tr.section_name?.includes(sec.name)
    );

    secTrains.forEach((tr) => {
      const trStart = new Date(tr.entry_time).getTime() - 10 * 60 * 1000; // 10 min safety buffer
      const trEnd = new Date(tr.exit_time).getTime() + 10 * 60 * 1000;

      secBlocks.forEach((b) => {
        const bStart = new Date(b.block_start).getTime();
        const bEnd = new Date(b.block_end).getTime();

        if (Math.max(trStart, bStart) < Math.min(trEnd, bEnd)) {
          conflicts.push({
            train: tr,
            block: b,
            sectionName: sec.name,
            overlapStart: new Date(Math.max(trStart, bStart)).toISOString(),
            overlapEnd: new Date(Math.min(trEnd, bEnd)).toISOString(),
          });
        }
      });
    });
  });

  return (
    <div className="bg-white border border-[#D9E1EA] rounded-xl shadow-xs overflow-hidden flex flex-col">
      {/* Gantt Controls Bar */}
      <div className="px-5 py-3 border-b border-[#D9E1EA] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F8FAFC]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-[#173F7A]" />
            <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-[#172033]">
              Operational Possession & Movement Timeline
            </h3>
          </div>
          <span className="text-[11px] font-mono text-[#667085] bg-white px-2 py-0.5 rounded border border-[#D9E1EA]">
            Operating Date: {baseDate}
          </span>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
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

          {/* Sub-lane & Element Legend */}
          <div className="hidden lg:flex items-center gap-3 text-[11px] font-medium text-[#667085]">
            <span className="flex items-center gap-1" title="Outer envelope authorized for track possession">
              <span className="w-3.5 h-2.5 rounded border border-dashed border-indigo-400 bg-indigo-50/80"></span>
              Possession Window
            </span>
            <span className="flex items-center gap-1" title="Actual physical maintenance work execution">
              <span className="w-3 h-2 rounded bg-[#173F7A]"></span>
              Task Work Duration
            </span>
            <span className="flex items-center gap-1" title="Time reserved for inspection and track handback">
              <span className="w-2.5 h-2 rounded border border-dashed border-amber-400 bg-amber-100"></span>
              Buffer & Handback
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-2 rounded bg-sky-600 text-white"></span>
              Train
            </span>
            <span className="flex items-center gap-1 font-bold text-[#173F7A]">
              <span className="w-3 h-2.5 rounded bg-gradient-to-r from-blue-200 via-amber-200 to-indigo-200 border-2 border-indigo-500"></span>
              JOINT BLOCK
            </span>
          </div>
        </div>
      </div>

      {/* Prominent Operational Conflict Banner */}
      {conflicts.length > 0 && (
        <div className="bg-red-50 border-b border-red-200 px-5 py-2.5 flex items-center justify-between gap-3 text-xs text-red-800 animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-600 flex-shrink-0 animate-bounce" />
            <span className="font-bold uppercase tracking-wider text-[11px] text-red-700 font-mono">
              Live Conflict Detected:
            </span>
            <span className="text-red-900 font-medium">
              Train {conflicts[0].train.train_number} ({conflicts[0].train.train_type}) now overlaps maintenance possession on {conflicts[0].sectionName} due to delay/schedule offset.
            </span>
          </div>
          <span className="text-[11px] font-semibold bg-white border border-red-300 text-red-700 px-2.5 py-1 rounded shadow-xs">
            Plan Needs Update • Re-plan Required
          </span>
        </div>
      )}

      {/* Gantt Chart Horizontal Scroll Container */}
      <div ref={containerRef} className="overflow-x-auto overflow-y-visible relative select-none">
        <div style={{ width: `${Math.max(900, totalTimelineWidth + 190)}px` }} className="relative">
          {/* Top Sticky Time Scale Header */}
          <div className="flex border-b border-[#D9E1EA] bg-[#F8FAFC] sticky top-0 z-20 text-[11px] font-mono text-[#667085]">
            {/* Left corner pinned header */}
            <div className="w-48 flex-shrink-0 px-4 py-2 border-r border-[#D9E1EA] bg-[#F8FAFC] sticky left-0 z-30 font-bold text-[#172033] uppercase text-[10px] tracking-wider flex items-center justify-between">
              <span>Section / Sub-Lane</span>
              <span className="text-[9px] text-[#667085]">Type</span>
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

                // Check conflicts for this section
                const secConflicts = conflicts.filter((c) => c.sectionName === sec.name);

                return (
                  <div key={sec.id} className="flex relative group hover:bg-slate-50/40 transition-colors">
                    {/* Sticky Left Column: Section Name with TRAINS and MAINTENANCE sub-labels */}
                    <div className="w-48 flex-shrink-0 border-r border-[#D9E1EA] bg-white sticky left-0 z-10 flex flex-col justify-between shadow-xs">
                      {/* Section Title Header */}
                      <div className="p-2.5 border-b border-slate-100">
                        <div className="font-bold text-xs text-[#172033] group-hover:text-[#173F7A] truncate">
                          {sec.name}
                        </div>
                        <div className="text-[10px] text-[#667085] font-mono mt-0.5">
                          {sec.from_station} → {sec.to_station}
                        </div>
                      </div>

                      {/* Sub-Lane Indicators */}
                      <div className="flex flex-col text-[9px] font-mono font-bold tracking-tight">
                        <div className="h-9 px-2.5 flex items-center gap-1.5 text-sky-700 bg-sky-50/60 border-b border-slate-100">
                          <TrainIcon className="w-3 h-3 text-sky-600" />
                          <span>TRAINS ({secTrains.length})</span>
                        </div>
                        <div className="h-16 px-2.5 flex items-center gap-1.5 text-indigo-800 bg-indigo-50/40">
                          <Clock className="w-3 h-3 text-indigo-600" />
                          <span>POSSESSIONS ({secBlocks.length})</span>
                        </div>
                      </div>
                    </div>

                    {/* Timeline Canvas for this Section */}
                    <div className="flex-1 relative overflow-hidden bg-white flex flex-col">
                      {/* Grid background vertical lines */}
                      <div className="absolute inset-0 flex pointer-events-none z-0">
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

                      {/* Overlap / Conflict Red Striped Regions */}
                      {secConflicts.map((sc, idx) => {
                        const { leftPx, widthPx } = getLeftAndWidth(sc.overlapStart, sc.overlapEnd);
                        return (
                          <div
                            key={`conflict-${idx}`}
                            style={{
                              left: `${leftPx}px`,
                              width: `${widthPx}px`,
                              backgroundImage:
                                'repeating-linear-gradient(45deg, rgba(239,68,68,0.22), rgba(239,68,68,0.22) 6px, transparent 6px, transparent 12px)',
                            }}
                            className="absolute top-0 bottom-0 border-x-2 border-red-500 z-10 pointer-events-none flex items-center justify-center"
                          >
                            <span className="bg-red-600 text-white text-[9px] font-bold font-mono px-1 py-0.5 rounded shadow-sm">
                              CONFLICT
                            </span>
                          </div>
                        );
                      })}

                      {/* ── Sub-lane 1: TRAINS ───────────────────────────────── */}
                      <div className="h-9 relative border-b border-slate-100 flex items-center z-5">
                        {secTrains.map((tr) => {
                          const { leftPx, widthPx } = getLeftAndWidth(tr.entry_time, tr.exit_time);
                          const isGoods = tr.train_type.toLowerCase().includes('goods');
                          const isDelayed = tr.delay_minutes && tr.delay_minutes > 0;
                          const bufferPx = (10 / 60) * hourWidth; // 10 min rear buffer

                          return (
                            <div
                              key={tr.id}
                              onMouseEnter={(e) => {
                                setHoveredTrain({ train: tr, x: e.clientX, y: e.clientY });
                              }}
                              onMouseMove={(e) => {
                                setHoveredTrain({ train: tr, x: e.clientX, y: e.clientY });
                              }}
                              onMouseLeave={() => setHoveredTrain(null)}
                              style={{
                                left: `${leftPx}px`,
                                width: `${widthPx + bufferPx}px`,
                              }}
                              className="absolute h-7 flex items-center transition-transform hover:scale-[1.02] cursor-pointer"
                            >
                              {/* Main Train Body */}
                              <div
                                style={{ width: `${widthPx}px` }}
                                className={`h-full rounded-l px-2 flex items-center justify-between text-white text-[10px] font-mono font-bold shadow-xs border ${
                                  isGoods
                                    ? 'bg-amber-600 border-amber-700'
                                    : 'bg-sky-600 border-sky-700'
                                }`}
                              >
                                <div className="flex items-center gap-1 truncate">
                                  <TrainIcon className="w-3 h-3 flex-shrink-0" />
                                  <span className="truncate">{tr.train_number}</span>
                                  <span className="text-[8px] font-normal opacity-90 hidden md:inline">
                                    · {tr.train_type}
                                  </span>
                                </div>
                                {isDelayed && (
                                  <span className="px-1 py-0.2 rounded bg-red-500 text-white text-[8px] font-black tracking-tight animate-pulse ml-1">
                                    +{tr.delay_minutes}m
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* ── Sub-lane 2: MAINTENANCE POSSESSION WINDOW & TASKS ── */}
                      <div className="h-16 relative z-5 flex items-center">
                        {secBlocks.map((b) => {
                          const { leftPx, widthPx } = getLeftAndWidth(b.block_start, b.block_end);
                          const isSelected = selectedBlockId === b.id;
                          const isJoint = b.is_joint_block || (b.departments && b.departments.length > 1);
                          const isApproved = b.approval_status === 'approved';
                          const startTime = new Date(b.block_start).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          });
                          const endTime = new Date(b.block_end).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          });

                          // Check if this block is involved in a conflict
                          const hasConflict = secConflicts.some((c) => c.block.id === b.id);

                          // Work tasks duration vs authorized possession duration
                          const maxTaskDuration = b.tasks && b.tasks.length > 0
                            ? Math.max(...b.tasks.map((t) => t.duration_min || 0))
                            : Math.min(b.duration_min, 120);
                          const effectiveTaskDuration = Math.min(b.duration_min, maxTaskDuration > 0 ? maxTaskDuration : b.duration_min);
                          const bufferMin = Math.max(0, b.duration_min - effectiveTaskDuration);
                          const taskWidthPct = Math.min(100, Math.max(15, (effectiveTaskDuration / b.duration_min) * 100));
                          const bufferWidthPct = 100 - taskWidthPct;

                          // Department styling
                          const dept = b.departments?.[0] || 'ENG';
                          let taskBarBg = 'bg-[#173F7A] text-white';
                          if (isJoint) {
                            taskBarBg = 'bg-gradient-to-r from-[#173F7A] via-amber-600 to-indigo-600 text-white';
                          } else if (dept === 'TRD') {
                            taskBarBg = 'bg-amber-600 text-white';
                          } else if (dept === 'SNT' || dept === 'SIG') {
                            taskBarBg = 'bg-indigo-600 text-white';
                          }

                          return (
                            <div
                              key={b.id}
                              onClick={() => onSelectBlock(b)}
                              onMouseEnter={(e) => {
                                setHoveredBlock(b);
                                setBlockTooltipPos({ x: e.clientX, y: e.clientY });
                              }}
                              onMouseMove={(e) => {
                                setHoveredBlock(b);
                                setBlockTooltipPos({ x: e.clientX, y: e.clientY });
                              }}
                              onMouseLeave={() => {
                                setHoveredBlock(null);
                                setBlockTooltipPos(null);
                              }}
                              style={{
                                left: `${leftPx}px`,
                                width: `${widthPx}px`,
                              }}
                              className={`absolute top-1 bottom-1 rounded-lg border-2 border-dashed p-1 cursor-pointer transition-all flex flex-col justify-between z-10 ${
                                isJoint
                                  ? 'border-indigo-500 bg-indigo-50/70 shadow-xs'
                                  : 'border-[#173F7A]/60 bg-blue-50/50'
                              } ${
                                hasConflict
                                  ? 'border-red-500 ring-2 ring-red-400/70 animate-pulse'
                                  : ''
                              } ${
                                isSelected
                                  ? 'ring-3 ring-[#173F7A] ring-offset-1 scale-[1.02] shadow-md z-20'
                                  : 'hover:scale-[1.01]'
                              }`}
                            >
                              {/* Top Bar: Authorized Possession Window Info */}
                              <div className="flex items-center justify-between gap-1 overflow-hidden leading-tight pb-0.5 text-[9px] font-mono">
                                <div className="flex items-center gap-1 truncate text-[#172033]">
                                  {hasConflict ? (
                                    <span className="px-1 py-0.2 rounded bg-red-600 text-white text-[8px] font-black tracking-tight font-mono flex items-center gap-0.5">
                                      <AlertTriangle className="w-2.5 h-2.5" />
                                      CONFLICT
                                    </span>
                                  ) : isJoint ? (
                                    <span className="px-1 py-0.2 rounded bg-indigo-600 text-white text-[8px] font-black tracking-tight font-mono">
                                      JOINT WINDOW
                                    </span>
                                  ) : (
                                    <span className="px-1 py-0.2 rounded bg-white border border-[#173F7A]/40 text-[#173F7A] text-[8px] font-bold font-mono">
                                      POSSESSION {b.duration_min}m
                                    </span>
                                  )}
                                  {widthPx > 110 && (
                                    <span className="font-semibold text-slate-700 truncate">
                                      {startTime}–{endTime}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1 flex-shrink-0">
                                  {b.locked && (
                                    <span title="Locked possession">
                                      <Lock className="w-2.5 h-2.5 text-[#173F7A]" />
                                    </span>
                                  )}
                                  {isApproved && (
                                    <span title="Approved">
                                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Inner Container: Solid Task Duration Bar + Buffer Margin */}
                              <div className="w-full h-6 rounded flex overflow-hidden border border-slate-300 bg-white/70 shadow-xs">
                                {/* Solid Task Execution Bar */}
                                <div
                                  style={{ width: `${taskWidthPct}%` }}
                                  className={`h-full px-1.5 flex items-center justify-between font-mono font-bold text-[9px] truncate shadow-inner ${taskBarBg}`}
                                  title={`Actual Work Duration: ${effectiveTaskDuration}m`}
                                >
                                  <div className="flex items-center gap-1 truncate">
                                    <span className="truncate">
                                      {isJoint
                                        ? b.departments?.join('·') || 'JOINT WORK'
                                        : b.tasks?.[0]?.task_code || `${dept} TASK`}
                                    </span>
                                  </div>
                                  <span className="flex-shrink-0 opacity-95">
                                    {effectiveTaskDuration}m
                                  </span>
                                </div>

                                {/* Handback Buffer Margin */}
                                {bufferMin > 0 && (
                                  <div
                                    style={{ width: `${bufferWidthPct}%` }}
                                    className="h-full border-l border-dashed border-amber-400 bg-amber-100/60 flex items-center justify-center font-mono text-[8px] font-bold text-amber-900 px-0.5 truncate"
                                    title={`Handback & Safety Clearance Margin: ${bufferMin} minutes`}
                                  >
                                    {widthPx > 130 ? (
                                      <span>+{bufferMin}m Buffer</span>
                                    ) : (
                                      <span>+{bufferMin}m</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Train Inspector Tooltip */}
      {hoveredTrain && (
        <div
          style={{
            position: 'fixed',
            left: `${Math.min(window.innerWidth - 280, hoveredTrain.x + 12)}px`,
            top: `${Math.min(window.innerHeight - 220, hoveredTrain.y + 12)}px`,
          }}
          className="z-50 bg-[#172033] text-white p-3.5 rounded-lg shadow-xl text-xs space-y-2 w-64 pointer-events-none border border-slate-700 animate-in fade-in duration-100"
        >
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-700">
            <div className="flex items-center gap-1.5">
              <TrainIcon className="w-3.5 h-3.5 text-sky-400" />
              <span className="font-mono font-bold text-sky-300">
                {hoveredTrain.train.train_number}
              </span>
            </div>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                hoveredTrain.train.delay_minutes && hoveredTrain.train.delay_minutes > 0
                  ? 'bg-red-900/80 text-red-200 border border-red-500'
                  : 'bg-emerald-900/80 text-emerald-200 border border-emerald-500'
              }`}
            >
              {hoveredTrain.train.delay_minutes && hoveredTrain.train.delay_minutes > 0
                ? `Delayed +${hoveredTrain.train.delay_minutes}m`
                : 'On-Time'}
            </span>
          </div>

          <div className="space-y-1 text-[11px]">
            <div className="flex justify-between text-slate-300">
              <span className="text-slate-400">Train Type:</span>
              <span className="font-semibold text-white">{hoveredTrain.train.train_type}</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span className="text-slate-400">Scheduled:</span>
              <span className="font-mono">
                {hoveredTrain.train.scheduled_entry_time
                  ? new Date(hoveredTrain.train.scheduled_entry_time).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : new Date(hoveredTrain.train.entry_time).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                →{' '}
                {hoveredTrain.train.scheduled_exit_time
                  ? new Date(hoveredTrain.train.scheduled_exit_time).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : new Date(hoveredTrain.train.exit_time).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
              </span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span className="text-slate-400">Current (Live):</span>
              <span className="font-mono text-amber-300 font-bold">
                {new Date(hoveredTrain.train.entry_time).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                →{' '}
                {new Date(hoveredTrain.train.exit_time).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span className="text-slate-400">Safety Buffer:</span>
              <span className="font-mono text-emerald-400">10 min (pre & post)</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span className="text-slate-400">Data Source:</span>
              <span className="text-slate-200">
                {hoveredTrain.train.source || 'CRIS Working Timetable (COA)'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Block Inspector Tooltip */}
      {hoveredBlock && blockTooltipPos && (
        <div
          style={{
            position: 'fixed',
            left: `${Math.min(window.innerWidth - 270, blockTooltipPos.x + 12)}px`,
            top: `${Math.min(window.innerHeight - 200, blockTooltipPos.y + 12)}px`,
          }}
          className="z-50 bg-[#172033] text-white p-3 rounded-lg shadow-xl text-xs space-y-1.5 w-64 pointer-events-none border border-slate-700 animate-in fade-in duration-100"
        >
          <div className="flex items-center justify-between pb-1 border-b border-slate-700">
            <span className="font-mono font-bold text-sky-300">
              {hoveredBlock.is_joint_block ? 'JOINT POSSESSION' : 'SINGLE BLOCK'}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono">
              {hoveredBlock.approval_status || 'Recommended'}
            </span>
          </div>

          <div className="font-bold text-sm">{hoveredBlock.section_name}</div>

          <div className="space-y-1 py-1 border-y border-slate-700 text-[11px] font-mono">
            <div className="flex justify-between text-slate-300">
              <span className="text-slate-400">Possession Window:</span>
              <span className="font-bold text-white">
                {new Date(hoveredBlock.block_start).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                –{' '}
                {new Date(hoveredBlock.block_end).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                ({hoveredBlock.duration_min}m)
              </span>
            </div>
            {(() => {
              const maxTask = hoveredBlock.tasks && hoveredBlock.tasks.length > 0
                ? Math.max(...hoveredBlock.tasks.map((t) => t.duration_min || 0))
                : hoveredBlock.duration_min;
              const taskDur = Math.min(hoveredBlock.duration_min, maxTask > 0 ? maxTask : hoveredBlock.duration_min);
              const buf = Math.max(0, hoveredBlock.duration_min - taskDur);
              return (
                <>
                  <div className="flex justify-between text-sky-300">
                    <span className="text-slate-400">Work Execution:</span>
                    <span className="font-bold">{taskDur} min</span>
                  </div>
                  {buf > 0 && (
                    <div className="flex justify-between text-amber-300">
                      <span className="text-slate-400">Handback Margin:</span>
                      <span className="font-bold">+{buf} min</span>
                    </div>
                  )}
                </>
              );
            })()}
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
