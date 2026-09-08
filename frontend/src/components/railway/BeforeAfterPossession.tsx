import { useState } from 'react';
import RailwayTrack from './RailwayTrack';
import StationNode from './StationNode';

interface BeforeAfterPossessionProps {
  className?: string;
  initialState?: 'before' | 'after';
}

export default function BeforeAfterPossession({
  className = '',
  initialState = 'before',
}: BeforeAfterPossessionProps) {
  const [isOptimized, setIsOptimized] = useState(initialState === 'after');

  return (
    <div className={`bg-white border border-border rounded-card p-6 shadow-xs ${className}`}>
      {/* Title & Interactive Toggle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4 mb-6">
        <div>
          <span className="text-2xs font-mono font-bold text-accent uppercase tracking-wider">
            FROM SILOED BLOCKS TO COORDINATED POSSESSIONS
          </span>
          <h2 className="text-lg font-bold text-text-primary mt-0.5">
            Operational Transformation on Section B–C
          </h2>
          <p className="text-xs text-text-secondary mt-1">
            Watch how three independent department closure requests are unified into a single coordinated possession window.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsOptimized(false)}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold border transition-all ${
              !isOptimized
                ? 'bg-slate-800 text-white border-slate-800 shadow-xs'
                : 'bg-panel text-text-secondary border-border hover:text-text-primary'
            }`}
          >
            1. Siloed Department Baselines
          </button>
          <button
            onClick={() => setIsOptimized(true)}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold border transition-all ${
              isOptimized
                ? 'bg-accent text-white border-accent shadow-xs'
                : 'bg-accent-tint text-accent border-accent/30 hover:bg-accent/10'
            }`}
          >
            2. Run SANGAM Coordinated Optimization ★
          </button>
        </div>
      </div>

      {/* Corridor Track Visualization */}
      <div className="relative py-4 px-2 bg-panel rounded-card border border-border">
        {/* Stations header */}
        <div className="flex items-center justify-between mb-4 px-2">
          <div className="flex items-center gap-2">
            <StationNode code="B" name="Station B" size="sm" isActive />
            <span className="text-xs font-bold text-text-primary">Intermediate Junction</span>
          </div>
          <div className="text-xs font-mono font-bold text-text-secondary uppercase">
            Section B–C (Double Line Track 1)
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-text-primary">River Bridge Approach</span>
            <StationNode code="C" name="Station C" size="sm" isActive />
          </div>
        </div>

        {/* 24h Timeline Time Ruler */}
        <div className="flex justify-between text-[10px] font-mono text-text-secondary border-b border-border pb-1 px-4 mb-3">
          <span>00:00</span>
          <span>04:00</span>
          <span>08:00</span>
          <span>12:00</span>
          <span>16:00</span>
          <span>20:00</span>
          <span>24:00</span>
        </div>

        {/* Technical Railway Track Line */}
        <div className="my-2">
          <RailwayTrack
            status={isOptimized ? 'joint' : 'conflict'}
            height={28}
            sleeperCount={36}
          />
        </div>

        {/* Blocks Area with Smooth Transition */}
        <div className="relative h-28 my-3 transition-all duration-700 ease-in-out">
          {!isOptimized ? (
            /* BEFORE SANGAM: 3 Separate Uncoordinated Blocks */
            <div className="w-full h-full flex flex-col justify-between py-1 transition-opacity duration-500">
              {/* Engineering block */}
              <div
                className="absolute left-[12%] w-[24%] h-7 rounded border border-blue-300 bg-blue-100/90 text-blue-900 px-2 flex items-center justify-between text-2xs font-semibold shadow-xs transition-all duration-700"
                style={{ top: '0%' }}
              >
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-600" /> ENG Track Tamping
                </span>
                <span className="font-mono">90 min</span>
              </div>

              {/* S&T block */}
              <div
                className="absolute left-[44%] w-[20%] h-7 rounded border border-indigo-300 bg-indigo-100/90 text-indigo-900 px-2 flex items-center justify-between text-2xs font-semibold shadow-xs transition-all duration-700"
                style={{ top: '35%' }}
              >
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-indigo-600" /> S&T Axle Counter
                </span>
                <span className="font-mono">75 min</span>
              </div>

              {/* TRD block */}
              <div
                className="absolute left-[70%] w-[26%] h-7 rounded border border-amber-300 bg-amber-100/90 text-amber-900 px-2 flex items-center justify-between text-2xs font-semibold shadow-xs transition-all duration-700"
                style={{ top: '70%' }}
              >
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-600" /> TRD Catenary Test
                </span>
                <span className="font-mono">105 min</span>
              </div>
            </div>
          ) : (
            /* AFTER SANGAM: 1 Joint Coordinated Possession */
            <div className="w-full h-full flex items-center justify-center transition-opacity duration-700">
              <div
                className="absolute left-[28%] w-[38%] h-20 rounded-card border-2 border-accent bg-gradient-to-r from-blue-50 via-indigo-50 to-amber-50 p-3 shadow-md flex flex-col justify-between transition-all duration-700 animate-in fade-in zoom-in-95"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded bg-blue-600 text-white text-[10px] font-bold">ENG</span>
                    <span className="px-1.5 py-0.5 rounded bg-indigo-600 text-white text-[10px] font-bold">S&T</span>
                    <span className="px-1.5 py-0.5 rounded bg-amber-600 text-white text-[10px] font-bold">TRD</span>
                    <span className="text-2xs font-bold text-accent uppercase tracking-wider ml-1">
                      JOINT POSSESSION
                    </span>
                  </div>
                  <span className="font-mono text-xs font-bold text-accent">01:05 → 02:45</span>
                </div>

                <div className="flex items-center justify-between text-2xs text-text-primary font-medium mt-1">
                  <span>Track Tamping + Axle Counter + Catenary</span>
                  <span className="font-mono font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                    100 MIN TOTAL CLOSURE
                  </span>
                </div>

                <div className="text-[10px] text-text-secondary flex items-center justify-between border-t border-border/70 pt-1">
                  <span>✓ Parallel work permitted</span>
                  <span>✓ 1 power isolation cycle</span>
                  <span className="font-bold text-emerald-800">170 MIN CORRIDOR TIME SAVED</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Impact Summary Pill */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-4 border-t border-border mt-3">
          <div className="p-3 bg-white rounded border border-border">
            <span className="text-2xs uppercase tracking-wider text-text-secondary font-medium">Total Line Closures</span>
            <div className="text-lg font-bold font-mono text-text-primary mt-0.5">
              {!isOptimized ? '3 Separate Blocks' : '1 Coordinated Joint Possession'}
            </div>
            <div className="text-2xs text-text-secondary">
              {!isOptimized ? 'Engineering, S&T, and TRD act independently' : 'Parallel crews co-located inside 1 gap'}
            </div>
          </div>

          <div className="p-3 bg-white rounded border border-border">
            <span className="text-2xs uppercase tracking-wider text-text-secondary font-medium">Corridor Downtime</span>
            <div className={`text-lg font-bold font-mono mt-0.5 ${!isOptimized ? 'text-red-600' : 'text-emerald-600'}`}>
              {!isOptimized ? '270 min (4.5 hours)' : '100 min (1.67 hours)'}
            </div>
            <div className="text-2xs text-text-secondary">
              {!isOptimized ? 'Extensive freight & passenger delays' : '63.0% corridor downtime reduction'}
            </div>
          </div>

          <div className="p-3 bg-white rounded border border-border">
            <span className="text-2xs uppercase tracking-wider text-text-secondary font-medium">Operational Benefit</span>
            <div className="text-lg font-bold font-mono text-accent mt-0.5">
              {!isOptimized ? '0 min saved (Status Quo)' : '+170 min Saved on Section'}
            </div>
            <div className="text-2xs text-text-secondary">
              {!isOptimized ? 'High section disruption risk' : 'Punctuality preserved on Trunk Route'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
