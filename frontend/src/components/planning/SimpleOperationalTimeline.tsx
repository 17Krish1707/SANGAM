import React from 'react';
import { type GeneratedBlock, type TimetableTrain } from '../../lib/apiClient';
import { Clock } from 'lucide-react';

interface SimpleOperationalTimelineProps {
  blocks: GeneratedBlock[];
  selectedBlockId?: string | null;
  onSelectBlock: (block: GeneratedBlock) => void;
  trains?: TimetableTrain[];
  planLabel?: string;
}

export const SimpleOperationalTimeline: React.FC<SimpleOperationalTimelineProps> = ({
  blocks,
  selectedBlockId,
  onSelectBlock,
  trains = [],
  planLabel = 'Plan A',
}) => {
  // Operational night/morning window: 00:00 to 06:00 (360 minutes)
  const windowStartMin = 0; // 00:00
  const windowEndMin = 360; // 06:00
  const totalWindowMin = windowEndMin - windowStartMin;

  const parseTimeToMinutes = (timeStr?: string): number => {
    if (!timeStr) return 0;
    try {
      const d = new Date(timeStr);
      if (!isNaN(d.getTime())) {
        return d.getHours() * 60 + d.getMinutes();
      }
      // If HH:MM format
      if (timeStr.includes(':')) {
        const parts = timeStr.split(':');
        return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
      }
    } catch {
      return 0;
    }
    return 0;
  };

  const getPositionPercent = (startMin: number, endMin: number) => {
    const clampedStart = Math.max(windowStartMin, Math.min(windowEndMin, startMin));
    const clampedEnd = Math.max(windowStartMin, Math.min(windowEndMin, endMin));
    const left = ((clampedStart - windowStartMin) / totalWindowMin) * 100;
    const width = Math.max(4, ((clampedEnd - clampedStart) / totalWindowMin) * 100);
    return { left: `${left}%`, width: `${width}%` };
  };

  const hours = [0, 1, 2, 3, 4, 5, 6];

  const upBlocks = blocks.filter((b) => (b.track_line || 'UP').toUpperCase() === 'UP');
  const downBlocks = blocks.filter((b) => (b.track_line || '').toUpperCase() === 'DOWN');

  // Filter trains within 00:00 - 06:00
  const filteredTrains = trains.filter((tr) => {
    const min = parseTimeToMinutes(tr.entry_time);
    return min >= windowStartMin && min <= windowEndMin;
  });

  const upTrains = filteredTrains.filter((tr) => (tr.direction || 'UP').toUpperCase() === 'UP');
  const downTrains = filteredTrains.filter((tr) => (tr.direction || '').toUpperCase() === 'DOWN');

  return (
    <div className="bg-white border border-[#D9E1EA] rounded-xl p-5 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#D9E1EA]">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#173F7A]" />
          <h3 className="font-bold text-sm text-[#172033]">
            Operational Possession Timeline — {planLabel} (Night Maintenance Window 00:00 – 06:00)
          </h3>
        </div>
        <div className="flex items-center gap-4 text-xs font-medium text-[#5A6E85]">
          <span className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-[#173F7A] inline-block" />
            <span>Scheduled Maintenance Possession</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-0.5 h-3.5 bg-amber-500 inline-block" />
            <span>Scheduled Train Movement</span>
          </span>
        </div>
      </div>

      {/* Timeline Grid */}
      <div className="relative pt-6 pb-2">
        {/* Time Axis Header */}
        <div className="relative h-6 border-b border-[#CBD5E1] text-[11px] font-mono text-[#64748B]">
          {hours.map((h) => {
            const leftPercent = ((h * 60) / totalWindowMin) * 100;
            return (
              <div
                key={h}
                className="absolute -translate-x-1/2 flex flex-col items-center"
                style={{ left: `${leftPercent}%` }}
              >
                <span>{h.toString().padStart(2, '0')}:00</span>
                <span className="w-px h-2 bg-[#94A3B8] mt-0.5" />
              </div>
            );
          })}
        </div>

        {/* Vertical Hour Guidelines */}
        <div className="absolute inset-0 top-12 pointer-events-none">
          {hours.map((h) => {
            const leftPercent = ((h * 60) / totalWindowMin) * 100;
            return (
              <div
                key={`grid-${h}`}
                className="absolute top-0 bottom-0 w-px border-r border-dashed border-[#F1F5F9]"
                style={{ left: `${leftPercent}%` }}
              />
            );
          })}
        </div>

        {/* ROWS */}
        <div className="space-y-4 pt-4 relative z-10">
          {/* UP LINE ROW */}
          <div className="flex items-center gap-3">
            <div className="w-24 shrink-0 font-bold text-xs text-[#173F7A] bg-[#F1F5F9] px-2.5 py-2 rounded border border-[#E2E8F0]">
              <div className="font-mono">UP LINE</div>
              <div className="text-[10px] text-[#64748B] font-normal">Southbound</div>
            </div>

            <div className="relative flex-1 h-14 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg overflow-hidden flex items-center">
              {/* Train Markers (thin lines) */}
              {upTrains.map((tr, idx) => {
                const trMin = parseTimeToMinutes(tr.entry_time);
                const pos = ((trMin - windowStartMin) / totalWindowMin) * 100;
                return (
                  <div
                    key={`up-tr-${idx}`}
                    className="absolute top-0 bottom-0 w-0.5 bg-amber-400 opacity-70 group hover:opacity-100 hover:w-1 hover:bg-amber-600 z-10 cursor-pointer transition-all"
                    style={{ left: `${pos}%` }}
                    title={`Train ${tr.train_number} (${tr.train_name || 'Scheduled'}): ${tr.entry_time?.slice(11, 16) || ''}`}
                  >
                    <div className="hidden group-hover:block absolute bottom-full mb-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-slate-800 text-white text-[10px] whitespace-nowrap z-30 shadow-md">
                      {tr.train_number} at {tr.entry_time?.slice(11, 16) || ''}
                    </div>
                  </div>
                );
              })}

              {/* Maintenance Blocks on UP */}
              {upBlocks.length === 0 ? (
                <div className="w-full text-center text-xs text-[#94A3B8] italic">
                  No maintenance blocks scheduled on UP Line
                </div>
              ) : (
                upBlocks.map((b) => {
                  const sMin = parseTimeToMinutes(b.block_start);
                  const eMin = parseTimeToMinutes(b.block_end);
                  const { left, width } = getPositionPercent(sMin, eMin);
                  const isSelected = selectedBlockId === b.id;

                  const taskCodes = b.tasks?.map((t) => t.task_code).join(' + ') || 'Joint Block';

                  return (
                    <div
                      key={b.id}
                      onClick={() => onSelectBlock(b)}
                      style={{ left, width }}
                      className={`absolute top-1 bottom-1 rounded-md px-3 py-1 flex flex-col justify-center cursor-pointer transition-all z-20 shadow-sm ${
                        isSelected
                          ? 'bg-[#173F7A] text-white ring-2 ring-amber-400 ring-offset-1'
                          : 'bg-[#1E4E8C] hover:bg-[#173F7A] text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 text-[11px] font-bold">
                        <span className="truncate">
                          {b.section_name}: {taskCodes}
                        </span>
                        <span className="font-mono text-[10px] bg-white/20 px-1.5 py-0.2 rounded shrink-0">
                          {b.duration_min}m
                        </span>
                      </div>
                      <div className="text-[10px] text-blue-100 flex items-center gap-2 mt-0.5">
                        <span className="font-mono">
                          {b.block_start?.slice(11, 16)}–{b.block_end?.slice(11, 16)}
                        </span>
                        <span>•</span>
                        <span className="truncate">
                          {b.protection_types?.join(' + ') || 'Possession'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* DOWN LINE ROW */}
          <div className="flex items-center gap-3">
            <div className="w-24 shrink-0 font-bold text-xs text-[#173F7A] bg-[#F1F5F9] px-2.5 py-2 rounded border border-[#E2E8F0]">
              <div className="font-mono">DOWN LINE</div>
              <div className="text-[10px] text-[#64748B] font-normal">Northbound</div>
            </div>

            <div className="relative flex-1 h-14 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg overflow-hidden flex items-center">
              {/* Train Markers (thin lines) */}
              {downTrains.map((tr, idx) => {
                const trMin = parseTimeToMinutes(tr.entry_time);
                const pos = ((trMin - windowStartMin) / totalWindowMin) * 100;
                return (
                  <div
                    key={`dn-tr-${idx}`}
                    className="absolute top-0 bottom-0 w-0.5 bg-amber-400 opacity-70 group hover:opacity-100 hover:w-1 hover:bg-amber-600 z-10 cursor-pointer transition-all"
                    style={{ left: `${pos}%` }}
                    title={`Train ${tr.train_number} (${tr.train_name || 'Scheduled'}): ${tr.entry_time?.slice(11, 16) || ''}`}
                  >
                    <div className="hidden group-hover:block absolute bottom-full mb-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-slate-800 text-white text-[10px] whitespace-nowrap z-30 shadow-md">
                      {tr.train_number} at {tr.entry_time?.slice(11, 16) || ''}
                    </div>
                  </div>
                );
              })}

              {/* Maintenance Blocks on DOWN */}
              {downBlocks.length === 0 ? (
                <div className="w-full text-center text-xs text-[#94A3B8] italic">
                  No maintenance blocks scheduled on DOWN Line
                </div>
              ) : (
                downBlocks.map((b) => {
                  const sMin = parseTimeToMinutes(b.block_start);
                  const eMin = parseTimeToMinutes(b.block_end);
                  const { left, width } = getPositionPercent(sMin, eMin);
                  const isSelected = selectedBlockId === b.id;

                  const taskCodes = b.tasks?.map((t) => t.task_code).join(' + ') || 'Joint Block';

                  return (
                    <div
                      key={b.id}
                      onClick={() => onSelectBlock(b)}
                      style={{ left, width }}
                      className={`absolute top-1 bottom-1 rounded-md px-3 py-1 flex flex-col justify-center cursor-pointer transition-all z-20 shadow-sm ${
                        isSelected
                          ? 'bg-[#173F7A] text-white ring-2 ring-amber-400 ring-offset-1'
                          : 'bg-[#1E4E8C] hover:bg-[#173F7A] text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 text-[11px] font-bold">
                        <span className="truncate">
                          {b.section_name}: {taskCodes}
                        </span>
                        <span className="font-mono text-[10px] bg-white/20 px-1.5 py-0.2 rounded shrink-0">
                          {b.duration_min}m
                        </span>
                      </div>
                      <div className="text-[10px] text-blue-100 flex items-center gap-2 mt-0.5">
                        <span className="font-mono">
                          {b.block_start?.slice(11, 16)}–{b.block_end?.slice(11, 16)}
                        </span>
                        <span>•</span>
                        <span className="truncate">
                          {b.protection_types?.join(' + ') || 'Possession'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
