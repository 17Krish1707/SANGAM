import { useState, useEffect, useMemo } from 'react';
import TopBar from '../../components/TopBar';
import WorkflowBar from '../../components/WorkflowBar';
import { usePlanning } from '../../context/PlanningContext';
import {
  getSections,
  getTasks,
  getAllTrains,
  getAllWindows,
  getCorridorInfrastructure,
  type Section,
  type MaintenanceTask,
  type TimetableTrain,
  type CorridorWindowFull,
  type CorridorInfrastructureData,
} from '../../lib/apiClient';
import {
  Clock,
  Layers,
  Zap,
  Radio,
  CheckCircle2,
} from 'lucide-react';

const CORRIDOR_STATIONS = [
  { name: 'Dadar', km: 0.0 },
  { name: 'Matunga', km: 1.8, span: '1.8 km' },
  { name: 'Sion', km: 4.0, span: '2.2 km' },
  { name: 'Kurla', km: 7.5, span: '3.5 km' },
  { name: 'Ghatkopar', km: 11.6, span: '4.1 km' },
  { name: 'Vikhroli', km: 14.8, span: '3.2 km' },
];

export default function TrainCorridorData() {
  const { setWorkflowStage } = usePlanning();

  const [sections, setSections] = useState<Section[]>([]);
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [trains, setTrains] = useState<TimetableTrain[]>([]);
  const [windows, setWindows] = useState<CorridorWindowFull[]>([]);
  const [infraData, setInfraData] = useState<CorridorInfrastructureData | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'infrastructure' | 'trains' | 'windows'>('infrastructure');

  useEffect(() => {
    setWorkflowStage(2);
    const loadAll = async () => {
      try {
        const [secList, taskList, trainList, winList, infra] = await Promise.all([
          getSections().catch(() => []),
          getTasks().catch(() => []),
          getAllTrains().catch(() => []),
          getAllWindows().catch(() => []),
          getCorridorInfrastructure('Dadar', 'Vikhroli').catch(() => null),
        ]);
        setSections(secList);
        setTasks(taskList);
        setTrains(trainList);
        setWindows(winList);
        setInfraData(infra);
        if (secList.length > 0 && !selectedSectionId) {
          setSelectedSectionId(secList[0].id);
        }
      } catch (err) {
        console.error('Failed to load corridor & trains data:', err);
      }
    };
    loadAll();
  }, [setWorkflowStage]);

  const selectedSection = useMemo(() => {
    return sections.find((s) => s.id === selectedSectionId) || sections[0] || null;
  }, [sections, selectedSectionId]);

  // Filter items for selected section
  const sectionTasks = useMemo(() => {
    if (!selectedSection) return [];
    return tasks.filter((t) => t.section_id === selectedSection.id || t.section_name === selectedSection.name);
  }, [tasks, selectedSection]);

  const sectionTrains = useMemo(() => {
    if (!selectedSection) return [];
    return trains.filter((tr) => tr.section_id === selectedSection.id);
  }, [trains, selectedSection]);

  const sectionWindows = useMemo(() => {
    if (!selectedSection) return [];
    return windows.filter((w) => w.section_id === selectedSection.id);
  }, [windows, selectedSection]);

  const sectionInfra = useMemo(() => {
    if (!infraData || !selectedSection) return { eng: [], snt: [], trd: [] };
    const eng = (infraData.departments?.engineering?.entities || []).filter(
      (e) => e.section_id === selectedSection.id || e.section_name === selectedSection.name
    );
    const snt = (infraData.departments?.signalling?.entities || []).filter(
      (e) => e.section_id === selectedSection.id || e.section_name === selectedSection.name
    );
    const trd = (infraData.departments?.traction?.entities || []).filter(
      (e) => e.section_id === selectedSection.id || e.section_name === selectedSection.name
    );
    return { eng, snt, trd };
  }, [infraData, selectedSection]);

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-slate-50">
      <TopBar title="Corridor & Trains" subtitle="What does this railway corridor look like and when can maintenance happen?" />
      <WorkflowBar activeStage={2} />

      <main className="p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Corridor &amp; Trains</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Operational corridor topology, railway infrastructure assets, scheduled train paths, and candidate maintenance windows.
          </p>
        </div>

        {/* Top Corridor Topology Visual Strip */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Mumbai Central Suburban Corridor (14.8 km)
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
              UP &amp; DOWN Double Track • 25 kV AC Electrified
            </span>
          </div>

          <div className="flex items-center justify-between overflow-x-auto py-3 px-2">
            {CORRIDOR_STATIONS.map((stn, idx) => (
              <div key={stn.name} className="flex items-center">
                {/* Station Node */}
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full border-2 border-[#173F7A] bg-blue-50 text-[#173F7A] flex items-center justify-center font-bold text-xs shadow-xs">
                    {stn.name.substring(0, 3).toUpperCase()}
                  </div>
                  <span className="text-xs font-bold text-slate-800 mt-1.5">{stn.name}</span>
                  <span className="text-[10px] font-mono text-slate-500">KM {stn.km.toFixed(1)}</span>
                </div>

                {/* Connecting Track Span */}
                {idx < CORRIDOR_STATIONS.length - 1 && (
                  <div className="flex flex-col items-center px-3 min-w-[70px] sm:min-w-[95px]">
                    <div className="w-full flex items-center">
                      <div className="w-2 h-2 rounded-full bg-slate-400" />
                      <div className="h-1 flex-1 bg-slate-300 relative">
                        <div className="absolute inset-0 bg-[#173F7A]/40" />
                      </div>
                      <div className="w-2 h-2 rounded-full bg-slate-400" />
                    </div>
                    <span className="text-[11px] font-mono font-semibold text-slate-600 mt-1">
                      {CORRIDOR_STATIONS[idx + 1].span}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 5 Corridor Section Cards */}
        <div>
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
            Select Section to Inspect
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3.5">
            {sections.map((sec) => {
              const isSelected = selectedSection?.id === sec.id;
              const secTCount = tasks.filter((t) => t.section_id === sec.id || t.section_name === sec.name).length;
              const secWCount = windows.filter((w) => w.section_id === sec.id).length;

              return (
                <div
                  key={sec.id}
                  onClick={() => setSelectedSectionId(sec.id)}
                  className={`cursor-pointer rounded-xl border p-4 transition-all ${
                    isSelected
                      ? 'bg-blue-50/80 border-[#173F7A] ring-2 ring-[#173F7A]/20 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-900 truncate">{sec.name}</span>
                    <span className="text-[10px] font-mono font-bold text-slate-500">{sec.length_km} km</span>
                  </div>

                  <div className="text-[11px] text-slate-600 space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      UP / DOWN Line
                    </div>
                    <div className="flex items-center justify-between text-slate-500 pt-1 border-t border-slate-100">
                      <span>Maintenance jobs</span>
                      <span className="font-bold text-slate-800">{secTCount}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-500">
                      <span>Candidate windows</span>
                      <span className="font-bold text-[#173F7A]">{secWCount}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section Detail Panel with 3 Tabs */}
        {selectedSection && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            {/* Header & Tabs */}
            <div className="p-5 border-b border-slate-200 bg-slate-50/75 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <span className="text-xs font-mono font-bold text-[#173F7A]">SECTION DETAIL</span>
                <h3 className="text-lg font-bold text-slate-900">
                  {selectedSection.name} ({selectedSection.length_km} km) • {sectionTasks.length} pending jobs
                </h3>
              </div>

              {/* 3 Tabs */}
              <div className="flex items-center gap-1 bg-slate-200/80 p-1 rounded-lg">
                <button
                  onClick={() => setActiveTab('infrastructure')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                    activeTab === 'infrastructure'
                      ? 'bg-white text-[#173F7A] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Infrastructure ({sectionInfra.eng.length + sectionInfra.snt.length + sectionInfra.trd.length})
                </button>
                <button
                  onClick={() => setActiveTab('trains')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                    activeTab === 'trains'
                      ? 'bg-white text-[#173F7A] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Train Movements ({sectionTrains.length})
                </button>
                <button
                  onClick={() => setActiveTab('windows')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                    activeTab === 'windows'
                      ? 'bg-white text-[#173F7A] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Available Windows ({sectionWindows.length})
                </button>
              </div>
            </div>

            {/* Tab 1: Infrastructure */}
            {activeTab === 'infrastructure' && (
              <div className="p-5 space-y-5">
                {/* Civil P-Way Assets */}
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-blue-600" />
                    Civil Engineering (P-Way Tracks &amp; Turnouts)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {sectionInfra.eng.map((asset) => (
                      <div key={asset.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                        <div className="flex items-center justify-between font-bold text-slate-900">
                          <span>{asset.asset_type}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-100 text-blue-800">
                            {asset.track_line}
                          </span>
                        </div>
                        <p className="text-slate-600">{asset.notes || 'Track Infrastructure Segment'}</p>
                        <div className="text-[11px] font-mono text-slate-500 pt-1">
                          Span: KM {asset.chainage_start_km?.toFixed(1) ?? '0.0'} → KM {asset.chainage_end_km?.toFixed(1) ?? '1.8'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* S&T Assets */}
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-purple-600" />
                    Signalling &amp; Telecom (Signals &amp; Point Machines)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {sectionInfra.snt.map((asset) => (
                      <div key={asset.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                        <div className="flex items-center justify-between font-bold text-slate-900">
                          <span>{asset.asset_type}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-purple-100 text-purple-800">
                            {asset.track_line}
                          </span>
                        </div>
                        <p className="text-slate-600">{asset.notes}</p>
                        <div className="text-[11px] font-mono text-slate-500 pt-1">
                          Location: {asset.start_ref} (KM {asset.chainage_start_km?.toFixed(1)})
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* TRD Assets */}
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-600" />
                    Traction Distribution (OHE Masts &amp; 25kV Isolations)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {sectionInfra.trd.map((asset) => (
                      <div key={asset.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                        <div className="flex items-center justify-between font-bold text-slate-900">
                          <span>{asset.asset_type}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-100 text-amber-800">
                            {asset.track_line}
                          </span>
                        </div>
                        <p className="text-slate-600">{asset.notes}</p>
                        <div className="text-[11px] font-mono text-slate-500 pt-1">
                          Coverage: {asset.start_ref} → {asset.end_ref}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Train Movements */}
            {activeTab === 'trains' && (
              <div className="p-5">
                {sectionTrains.length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center">No train movements registered on this section.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-100/75 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
                          <th className="py-2.5 px-3">Train No.</th>
                          <th className="py-2.5 px-3">Type</th>
                          <th className="py-2.5 px-3">Section Entry</th>
                          <th className="py-2.5 px-3">Section Exit</th>
                          <th className="py-2.5 px-3">Description / Service</th>
                          <th className="py-2.5 px-3 text-center">Priority</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {sectionTrains.map((tr) => (
                          <tr key={tr.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-mono font-bold text-[#173F7A]">
                              {tr.train_number}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                tr.train_type === 'Passenger' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {tr.train_type}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-700">
                              {new Date(tr.entry_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-700">
                              {new Date(tr.exit_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">
                              {tr.notes || 'Suburban Scheduled Service'}
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-slate-700">
                              {tr.priority}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Available Windows */}
            {activeTab === 'windows' && (
              <div className="p-5">
                {sectionWindows.length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center">No block windows computed for this section.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {sectionWindows.map((win, idx) => {
                      const sTime = new Date(win.window_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      const eTime = new Date(win.window_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      const durMin = Math.round((new Date(win.window_end).getTime() - new Date(win.window_start).getTime()) / 60000);

                      return (
                        <div key={win.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800 flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-[#173F7A]" />
                              Window {idx + 1}: {sTime} – {eTime}
                            </span>
                            <span className="px-2 py-0.5 rounded font-bold font-mono text-xs bg-blue-100 text-blue-900">
                              {durMin} min
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-slate-600 pt-1 border-t border-slate-200/70">
                            <span>Status</span>
                            <span className="font-semibold text-emerald-700 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Available for Maintenance
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-slate-500">
                            <span>Corridor Risk Score</span>
                            <span className="font-mono font-bold text-slate-700">
                              {win.risk_score ? (win.risk_score * 100).toFixed(0) : '15'} / 100
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
