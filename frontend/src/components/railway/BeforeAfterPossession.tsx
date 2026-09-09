import { useState } from 'react';
import RailwayTrack from './RailwayTrack';
import StationNode from './StationNode';
import { CheckCircle2, TrendingDown } from 'lucide-react';

interface BeforeAfterPossessionProps {
  className?: string;
  initialState?: 'before' | 'after';
  isOptimized?: boolean;
  onToggleOptimized?: (val: boolean) => void;
}

export default function BeforeAfterPossession({
  className = '',
  initialState = 'after',
  isOptimized: propIsOptimized,
  onToggleOptimized,
}: BeforeAfterPossessionProps) {
  const [internalOptimized, setInternalOptimized] = useState(initialState === 'after');
  const isOptimized = propIsOptimized !== undefined ? propIsOptimized : internalOptimized;

  const handleToggle = (val: boolean) => {
    setInternalOptimized(val);
    onToggleOptimized?.(val);
  };

  return (
    <div className={`bg-white border border-[#D9E1EA] rounded-xl p-6 shadow-xs ${className}`}>
      {/* Title & Interactive Mode Toggle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#D9E1EA] pb-4 mb-6">
        <div>
          <span className="text-[10px] font-mono font-bold text-[#173F7A] uppercase tracking-wider">
            CORE MATHEMATICAL VALUE DEMONSTRATION
          </span>
          <h2 className="text-lg font-bold text-[#172033] mt-0.5">
            Before SANGAM vs. With SANGAM
          </h2>
          <p className="text-xs text-[#667085] mt-1">
            Section B–C Joint Coordinated Possession: See how 3 siloed department blocks collapse into 1 shared window.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleToggle(false)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              !isOptimized
                ? 'bg-slate-800 text-white border-slate-800 shadow-xs'
                : 'bg-slate-50 text-[#667085] border-[#D9E1EA] hover:text-[#172033]'
            }`}
          >
            1. Without SANGAM (Separate Closures)
          </button>
          <button
            onClick={() => handleToggle(true)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              isOptimized
                ? 'bg-[#173F7A] text-white border-[#173F7A] shadow-xs'
                : 'bg-sky-50 text-[#173F7A] border-sky-200 hover:bg-sky-100'
            }`}
          >
            2. With SANGAM (Shared Block) ★
          </button>
        </div>
      </div>

      {/* Visual Comparison Box */}
      <div className="relative py-4 px-4 bg-[#F8FAFC] rounded-xl border border-[#D9E1EA]">
        {/* Stations Header */}
        <div className="flex items-center justify-between mb-4 px-1">
          <div className="flex items-center gap-2">
            <StationNode code="B" name="Station B" size="sm" isActive />
            <span className="text-xs font-bold text-[#172033]">Junction B</span>
          </div>
          <div className="text-xs font-mono font-bold text-[#667085] uppercase tracking-wide">
            Section B–C (28 KM Double Line)
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#172033]">Terminal C</span>
            <StationNode code="C" name="Station C" size="sm" isActive />
          </div>
        </div>

        {/* Railway Track Representation */}
        <div className="my-2">
          <RailwayTrack
            status={isOptimized ? 'joint' : 'conflict'}
            height={28}
            sleeperCount={36}
          />
        </div>

        {/* 24-hour Time Ruler */}
        <div className="flex justify-between text-[10px] font-mono text-[#667085] border-b border-slate-200 pb-1 px-3 mb-4">
          <span>00:00</span>
          <span>04:00</span>
          <span>08:00</span>
          <span>12:00</span>
          <span>16:00</span>
          <span>20:00</span>
          <span>24:00</span>
        </div>

        {/* Dynamic Diagram Area */}
        <div className="relative min-h-[140px] my-3">
          {!isOptimized ? (
            /* WITHOUT SANGAM: 3 Separate Uncoordinated Closures */
            <div className="space-y-2.5 animate-in fade-in duration-300">
              <div className="flex items-center gap-3">
                <span className="w-12 text-[11px] font-mono font-bold text-blue-700">ENG</span>
                <div className="relative flex-1 h-8 bg-slate-100 rounded border border-slate-200 overflow-hidden">
                  <div
                    style={{ left: '15%', width: '25%' }}
                    className="absolute top-0 bottom-0 bg-blue-100 border border-blue-400 rounded px-2 flex items-center justify-between text-[11px] font-bold text-blue-900"
                  >
                    <span>Track Tamping (ENG-001)</span>
                    <span className="font-mono">90 min</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="w-12 text-[11px] font-mono font-bold text-indigo-700">S&T</span>
                <div className="relative flex-1 h-8 bg-slate-100 rounded border border-slate-200 overflow-hidden">
                  <div
                    style={{ left: '45%', width: '18%' }}
                    className="absolute top-0 bottom-0 bg-indigo-100 border border-indigo-400 rounded px-2 flex items-center justify-between text-[11px] font-bold text-indigo-900"
                  >
                    <span>Point Machine (SNT-001)</span>
                    <span className="font-mono">45 min</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="w-12 text-[11px] font-mono font-bold text-amber-700">TRD</span>
                <div className="relative flex-1 h-8 bg-slate-100 rounded border border-slate-200 overflow-hidden">
                  <div
                    style={{ left: '68%', width: '22%' }}
                    className="absolute top-0 bottom-0 bg-amber-100 border border-amber-400 rounded px-2 flex items-center justify-between text-[11px] font-bold text-amber-900"
                  >
                    <span>Catenary Inspection (TRD-001)</span>
                    <span className="font-mono">60 min</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2 text-xs font-mono font-bold text-red-700">
                Total Separate Closures: 90 + 45 + 60 = <span className="underline ml-1">195 min</span>
              </div>
            </div>
          ) : (
            /* WITH SANGAM: 1 Shared Joint Block */
            <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl border-2 border-indigo-500 shadow-sm animate-in fade-in zoom-in-95 duration-300">
              <div className="w-full flex items-center justify-between mb-3 border-b border-indigo-100 pb-2">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <span className="px-1.5 py-0.5 rounded bg-blue-600 text-white text-[10px] font-bold">ENG</span>
                    <span className="px-1.5 py-0.5 rounded bg-indigo-600 text-white text-[10px] font-bold">S&T</span>
                    <span className="px-1.5 py-0.5 rounded bg-amber-600 text-white text-[10px] font-bold">TRD</span>
                  </div>
                  <span className="text-xs font-bold text-[#173F7A] uppercase tracking-wider">
                    Shared Maintenance Block (B–C-03)
                  </span>
                </div>
                <span className="text-xs font-mono font-bold bg-indigo-50 text-indigo-800 px-2.5 py-1 rounded border border-indigo-200">
                  04:15 → 05:45 (90 min)
                </span>
              </div>

              <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs mb-3">
                <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-lg">
                  <span className="font-bold text-blue-900 block">ENG-001 (Track Tamping)</span>
                  <span className="text-[11px] text-blue-700">Requires 90 min • Heavy machinery</span>
                </div>
                <div className="p-2.5 bg-indigo-50/70 border border-indigo-200 rounded-lg">
                  <span className="font-bold text-indigo-900 block">SNT-001 (Point Machine)</span>
                  <span className="text-[11px] text-indigo-700">Requires 45 min • Fits inside 90m</span>
                </div>
                <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-lg">
                  <span className="font-bold text-amber-900 block">TRD-001 (Catenary Wire)</span>
                  <span className="text-[11px] text-amber-700">Requires 60 min • Shared power shut</span>
                </div>
              </div>

              <div className="w-full bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span className="text-emerald-900 font-medium">
                    Corridor Closed: <strong>90 min</strong> instead of 195 min
                  </span>
                </div>
                <div className="font-bold font-mono text-emerald-700 text-sm">
                  Track Availability Saved: 105 min (53.8% reduction)
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Whole-Corridor Impact Summary (3 Sections / 11 Tasks) */}
        <div className="mt-4 pt-4 border-t border-slate-200">
          <div className="text-[11px] font-bold text-[#667085] uppercase tracking-wider mb-2">
            Whole Corridor Aggregation (3 Sections · 11 Maintenance Tasks)
          </div>

          {!isOptimized ? (
            /* WITHOUT SANGAM: Show only old values */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-[#667085] block">
                  Total Track Closure
                </span>
                <div className="text-lg font-bold font-mono text-slate-800 mt-0.5">
                  24.33 hrs
                </div>
                <span className="text-[10px] text-[#667085]">11 separate closures</span>
              </div>

              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-[#667085] block">
                  Coordinated Joint Blocks
                </span>
                <div className="text-lg font-bold font-mono text-slate-800 mt-0.5">
                  0 joint blocks
                </div>
                <span className="text-[10px] text-[#667085]">100% siloed departmental possessions</span>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-600 block">
                  Corridor Savings
                </span>
                <div className="text-lg font-black font-mono text-slate-500 mt-0.5">
                  0.00 hrs (0.0%)
                </div>
                <span className="text-[10px] text-slate-500 font-medium">Uncoordinated baseline</span>
              </div>

              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-[#667085] block">
                  Jobs Completed
                </span>
                <div className="text-lg font-black font-mono text-slate-800 mt-0.5">
                  11 / 11
                </div>
                <span className="text-[10px] text-[#667085]">Across 11 separate windows</span>
              </div>
            </div>
          ) : (
            /* WITH SANGAM: Show new ones with old striked */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-[#667085] block">
                  Total Track Closure
                </span>
                <div className="text-lg font-bold font-mono mt-0.5 flex items-baseline gap-1.5">
                  <span className="text-slate-400 line-through text-sm">24.33 hrs</span>
                  <span className="text-[#173F7A]">16.33 hrs</span>
                </div>
                <span className="text-[10px] text-[#667085]">Down from 11 separate closures</span>
              </div>

              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-[#667085] block">
                  Coordinated Joint Blocks
                </span>
                <div className="text-lg font-bold font-mono mt-0.5 flex items-baseline gap-1.5">
                  <span className="text-slate-400 line-through text-sm">0 joint</span>
                  <span className="text-indigo-700">5 blocks (3 joint)</span>
                </div>
                <span className="text-[10px] text-indigo-900 font-medium">Shared multi-department cuts</span>
              </div>

              <div className="bg-emerald-50 p-3 rounded-lg border-2 border-emerald-200">
                <span className="text-[10px] uppercase font-bold text-emerald-800 block">
                  Corridor Savings
                </span>
                <div className="text-lg font-black font-mono text-emerald-700 mt-0.5 flex items-center gap-1">
                  <TrendingDown className="w-4 h-4" />
                  8.00 hrs (32.9%)
                </div>
                <span className="text-[10px] text-emerald-800 font-medium">Reclaimed for train traffic</span>
              </div>

              <div className="bg-blue-50 p-3 rounded-lg border-2 border-blue-200">
                <span className="text-[10px] uppercase font-bold text-blue-800 block">
                  Jobs Completed
                </span>
                <div className="text-lg font-black font-mono text-blue-700 mt-0.5">
                  11 / 11 (100%)
                </div>
                <span className="text-[10px] text-blue-800 font-medium">Zero deferred tasks</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
