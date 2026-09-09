import { useState, useEffect } from 'react';
import TopBar from '../components/TopBar';
import Panel from '../components/ui/Panel';
import DataTable, { type ColumnDef } from '../components/ui/DataTable';
import CorridorDiagram from '../components/railway/CorridorDiagram';
import {
  getSections,
  getCorridorWindows,
  getSectionOccupancy,
  type Section,
  type CorridorWindow,
  type SectionOccupancyData,
} from '../lib/apiClient';
import {
  ShieldAlert,
  Info,
  Activity,
} from 'lucide-react';

const DEFAULT_CORRIDOR_DATE = '2026-09-07';

function fmtTime(iso: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function riskBadge(score: number | null) {
  if (score == null) return <span className="text-text-secondary">—</span>;
  if (score <= 0.3) {
    return (
      <span className="inline-flex items-center gap-1 text-2xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
        {(score * 100).toFixed(0)}% Low Risk
      </span>
    );
  }
  if (score <= 0.6) {
    return (
      <span className="inline-flex items-center gap-1 text-2xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
        {(score * 100).toFixed(0)}% Moderate
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-2xs font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
      {(score * 100).toFixed(0)}% High Risk
    </span>
  );
}

export default function CorridorAvailability() {
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [occupancy, setOccupancy] = useState<SectionOccupancyData | null>(null);
  const [windows, setWindows] = useState<CorridorWindow[]>([]);
  const [loadingOccupancy, setLoadingOccupancy] = useState(true);
  const [selectedWindow, setSelectedWindow] = useState<CorridorWindow | null>(null);

  // Load sections on mount
  useEffect(() => {
    getSections()
      .then((data) => {
        setSections(data);
        if (data.length > 0 && !selectedSectionId) {
          setSelectedSectionId(data[0].id);
        }
      })
      .catch((err) => console.error('Failed loading corridor sections', err));
  }, []);

  // Load occupancy & windows when section changes
  useEffect(() => {
    if (!selectedSectionId) return;
    setLoadingOccupancy(true);
    setSelectedWindow(null);

    Promise.all([
      getSectionOccupancy(selectedSectionId, DEFAULT_CORRIDOR_DATE),
      getCorridorWindows(selectedSectionId, `${DEFAULT_CORRIDOR_DATE}T00:00:00`, `${DEFAULT_CORRIDOR_DATE}T23:59:59`),
    ])
      .then(([occData, winData]) => {
        setOccupancy(occData);
        setWindows(winData);
      })
      .catch((err) => console.error('Failed loading section occupancy', err))
      .finally(() => setLoadingOccupancy(false));
  }, [selectedSectionId]);

  const selectedSection = sections.find((s) => s.id === selectedSectionId);

  const windowColumns: ColumnDef<CorridorWindow>[] = [
    {
      key: 'window_start',
      header: 'Start Time',
      width: 'w-24',
      render: (w) => <span className="font-mono text-xs">{fmtTime(w.window_start)}</span>,
    },
    {
      key: 'window_end',
      header: 'End Time',
      width: 'w-24',
      render: (w) => <span className="font-mono text-xs">{fmtTime(w.window_end)}</span>,
    },
    {
      key: 'duration_min',
      header: 'Duration',
      width: 'w-24',
      render: (w) => (
        <span className="font-mono text-xs font-semibold text-text-primary">
          {w.duration_min} min ({((w.duration_min || 0) / 60).toFixed(1)}h)
        </span>
      ),
    },
    {
      key: 'risk_score',
      header: 'Risk Classification',
      render: (w) => riskBadge(w.risk_score),
    },
    {
      key: 'is_available',
      header: 'Status',
      width: 'w-24',
      render: (w) => (
        <span
          className={`text-2xs font-bold px-2 py-0.5 rounded border ${
            w.is_available
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-slate-100 text-slate-600 border-slate-200'
          }`}
        >
          {w.is_available ? 'Available' : 'Restricted'}
        </span>
      ),
    },
  ];

  return (
    <>
      <TopBar
        title="Corridor Capacity & Headway Windows"
        subtitle="24-Hour Train Density, Headway Buffer Protection & Maintenance Feasibility"
      />

      <main className="flex-1 overflow-y-auto bg-panel p-6 space-y-5">
        {/* Interactive Corridor Strip */}
        <CorridorDiagram
          onSelectSection={(secId) => setSelectedSectionId(secId)}
        />

        {/* ── 24-Hour Section Occupancy Timeline ── */}
        <Panel
          title={
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-accent" />
                <span>
                  24-Hour Section Time-Space Profile — {selectedSection?.name || 'Corridor'} (
                  {selectedSection?.from_station} - {selectedSection?.to_station})
                </span>
              </div>
              <div className="flex items-center gap-3 text-2xs font-mono text-text-secondary">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-blue-600 inline-block" /> Passenger
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-600 inline-block" /> Freight
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-indigo-200 inline-block border border-dashed border-indigo-400" />{' '}
                  15m Safety Buffer
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> Candidate Window
                </span>
              </div>
            </div>
          }
        >
          {loadingOccupancy ? (
            <div className="p-12 text-center text-text-secondary text-xs animate-pulse">
              Generating section train paths and headway buffers...
            </div>
          ) : !occupancy ? (
            <div className="p-8 text-center text-text-secondary text-xs">
              No occupancy data found for this section.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary Stats Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-panel p-3 rounded-lg border border-border text-xs">
                <div>
                  <span className="text-text-secondary block text-2xs uppercase">Daily Trains</span>
                  <span className="font-mono text-base font-bold text-text-primary">
                    {occupancy.passenger_train_count + occupancy.goods_train_count} Paths
                  </span>
                  <span className="text-2xs text-text-secondary block">
                    {occupancy.passenger_train_count} Pax · {occupancy.goods_train_count} Goods
                  </span>
                </div>
                <div>
                  <span className="text-text-secondary block text-2xs uppercase">Corridor Congestion</span>
                  <span className="font-mono text-base font-bold text-accent">
                    {(((1440 - occupancy.total_available_minutes) / 1440) * 100).toFixed(1)}%
                  </span>
                  <span className="text-2xs text-text-secondary block">Track utilization rate</span>
                </div>
                <div>
                  <span className="text-text-secondary block text-2xs uppercase">Headway Buffers</span>
                  <span className="font-mono text-base font-bold text-emerald-700">
                    {occupancy.candidate_windows.length} Viable Windows
                  </span>
                  <span className="text-2xs text-text-secondary block">Gaps &ge; 60 mins</span>
                </div>
                <div>
                  <span className="text-text-secondary block text-2xs uppercase">Scheduled Blocks</span>
                  <span className="font-mono text-base font-bold text-indigo-700">
                    {occupancy.scheduled_blocks.length} Approved
                  </span>
                  <span className="text-2xs text-text-secondary block">Active possession</span>
                </div>
              </div>

              {/* Graphical 24-Hour Timeline Bar */}
              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between text-2xs font-mono text-text-secondary px-1">
                  <span>00:00</span>
                  <span>03:00</span>
                  <span>06:00</span>
                  <span>09:00</span>
                  <span>12:00</span>
                  <span>15:00</span>
                  <span>18:00</span>
                  <span>21:00</span>
                  <span>24:00</span>
                </div>

                {/* Timeline Canvas Container */}
                <div className="relative h-14 bg-slate-100 rounded-md border border-border overflow-hidden select-none">
                  {/* Grid Lines */}
                  {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => (
                    <div
                      key={h}
                      className="absolute top-0 bottom-0 border-l border-slate-300/60"
                      style={{ left: `${(h / 24) * 100}%` }}
                    />
                  ))}

                  {/* Candidate Windows (Green Backgrounds) */}
                  {occupancy.candidate_windows.map((w: any, idx: number) => {
                    const startMin =
                      new Date(w.window_start).getHours() * 60 +
                      new Date(w.window_start).getMinutes();
                    const leftPct = (startMin / 1440) * 100;
                    const widthPct = (w.duration_min / 1440) * 100;

                    return (
                      <div
                        key={`gap-${idx}`}
                        className="absolute top-0 bottom-0 bg-emerald-100/70 border-x border-emerald-300 flex items-center justify-center cursor-pointer hover:bg-emerald-200/80 transition-colors"
                        style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                        title={`Candidate Window: ${w.window_start.slice(11, 16)} - ${w.window_end.slice(11, 16)} (${w.duration_min}m)`}
                        onClick={() => setSelectedWindow(w)}
                      >
                        <span className="text-[9px] font-mono font-bold text-emerald-800 truncate px-1">
                          {w.duration_min}m
                        </span>
                      </div>
                    );
                  })}

                  {/* Scheduled Blocks (Possession Bands) */}
                  {occupancy.scheduled_blocks.map((b: any) => {
                    const startMin =
                      new Date(b.block_start).getHours() * 60 +
                      new Date(b.block_start).getMinutes();
                    const durMin = b.duration_min || 180;
                    const leftPct = (startMin / 1440) * 100;
                    const widthPct = (durMin / 1440) * 100;

                    return (
                      <div
                        key={`blk-${b.id}`}
                        className="absolute top-1 bottom-1 bg-indigo-600/90 text-white rounded px-1.5 flex items-center justify-between text-[10px] font-mono font-bold border border-indigo-800 shadow-xs z-10"
                        style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                        title={`SANGAM Coordinated Block #${b.id}: ${b.block_start.slice(11, 16)} - ${b.block_end.slice(11, 16)}`}
                      >
                        <span className="truncate">BLOCK #{b.id.slice(0, 6)}</span>
                        <span>{b.is_joint_block ? 'JOINT' : 'STD'}</span>
                      </div>
                    );
                  })}

                  {/* Trains and Safety Buffers */}
                  {occupancy.trains.map((t: any) => {
                    const startMin =
                      new Date(t.entry_time).getHours() * 60 +
                      new Date(t.entry_time).getMinutes();
                    const leftPct = (startMin / 1440) * 100;
                    const isPax = t.train_type === 'Passenger';

                    return (
                      <div
                        key={t.id}
                        className="absolute top-0 bottom-0 flex flex-col justify-center items-center group cursor-pointer z-20"
                        style={{ left: `${leftPct}%` }}
                        title={`Train Movement (${t.train_type}) @ ${t.entry_time.slice(11, 16)}`}
                      >
                        {/* Train Line */}
                        <div
                          className={`w-1 h-full ${
                            isPax ? 'bg-blue-600' : 'bg-amber-600'
                          } group-hover:w-1.5 transition-all`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </Panel>

        {/* ── Two-Column Layout: Window Risk Breakdown & Candidate Windows List ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left 2 Cols: Candidate Windows Table */}
          <div className="lg:col-span-2">
            <Panel
              title={`Candidate Maintenance Windows (${windows.length})`}
              action={
                <span className="text-2xs text-text-secondary font-mono">
                  Calibrated against train timetable gaps &ge; 60 mins
                </span>
              }
            >
              <DataTable
                columns={windowColumns}
                rows={windows}
                rowKey={(w) => w.id}
                loading={loadingOccupancy}
                emptyMessage="No candidate windows identified for this date."
                onRowClick={(w) => setSelectedWindow(w)}
              />
            </Panel>
          </div>

          {/* Right Col: Window Risk Explanation Inspector */}
          <div className="space-y-4">
            <Panel
              title={
                <div className="flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-accent" />
                  <span>Risk Explanation Model</span>
                </div>
              }
            >
              {selectedWindow ? (
                <div className="space-y-4 text-xs">
                  <div className="p-3 bg-panel rounded-lg border border-border space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-text-primary">
                        Window #{selectedWindow.id.slice(0, 8)}
                      </span>
                      {riskBadge(selectedWindow.risk_score)}
                    </div>
                    <div className="text-2xs text-text-secondary font-mono">
                      {fmtTime(selectedWindow.window_start)} &rarr; {fmtTime(selectedWindow.window_end)} ({selectedWindow.duration_min} min)
                    </div>
                  </div>

                  {/* 4-Factor Risk Model */}
                  <div className="space-y-2.5">
                    <h4 className="text-2xs font-bold text-text-secondary uppercase tracking-wider">
                      Operational Risk Factor Breakdown
                    </h4>

                    {/* Factor 1: Peak Hour Traffic */}
                    <div>
                      <div className="flex justify-between text-2xs mb-1">
                        <span className="text-text-primary font-medium">1. Peak Traffic Penalty</span>
                        <span className="font-mono text-text-secondary">
                          {(selectedWindow.risk_score || 0.2) > 0.5 ? 'High (Peak)' : 'Low (Off-peak)'}
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 rounded-full"
                          style={{ width: `${Math.min(100, (selectedWindow.risk_score || 0.2) * 110)}%` }}
                        />
                      </div>
                    </div>

                    {/* Factor 2: Freight Variability */}
                    <div>
                      <div className="flex justify-between text-2xs mb-1">
                        <span className="text-text-primary font-medium">2. Freight Flow Uncertainty</span>
                        <span className="font-mono text-text-secondary">
                          {(selectedWindow.risk_score || 0.3) > 0.4 ? 'Moderate' : 'Low'}
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full"
                          style={{ width: `${Math.min(100, (selectedWindow.risk_score || 0.3) * 90)}%` }}
                        />
                      </div>
                    </div>

                    {/* Factor 3: Adjacent Section Cascading */}
                    <div>
                      <div className="flex justify-between text-2xs mb-1">
                        <span className="text-text-primary font-medium">3. Adjacent Section Buffer</span>
                        <span className="font-mono text-text-secondary">
                          Safe Margin &gt; 25m
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-600 rounded-full"
                          style={{ width: `${Math.min(100, (1 - (selectedWindow.risk_score || 0.2)) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Factor 4: 25kV Traction Interlocking */}
                    <div>
                      <div className="flex justify-between text-2xs mb-1">
                        <span className="text-text-primary font-medium">4. OHE Power Sectioning Feasibility</span>
                        <span className="font-mono text-emerald-700 font-semibold">Available</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-600 rounded-full" style={{ width: '85%' }} />
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-md text-2xs text-blue-900 leading-relaxed">
                    <strong>Optimizer Recommendation:</strong>{' '}
                    {(selectedWindow.risk_score || 0) <= 0.35
                      ? 'Prime candidate for joint multi-department possession. High buffer headroom minimizes delay risk.'
                      : 'Suitable for single department maintenance or speed-restricted single-line work only.'}
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-text-secondary text-xs">
                  Click any window from the table or timeline to inspect its mathematical risk score breakdown.
                </div>
              )}
            </Panel>

            {/* Quick Rules Card */}
            <div className="bg-white p-4 rounded-lg border border-border text-xs space-y-2">
              <h4 className="font-bold text-text-primary flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-accent" />
                <span>Headway Buffer Rules</span>
              </h4>
              <ul className="text-2xs text-text-secondary space-y-1.5 list-disc pl-4">
                <li>Minimum 15-minute buffer enforced before incoming Mail/Express train.</li>
                <li>Minimum 60-minute contiguous gap required for mechanized tamping.</li>
                <li>TRD power blocks require adjacent feeder circuit isolation validation.</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
