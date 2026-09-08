import React, { useState, useEffect } from 'react';
import TopBar from '../../components/TopBar';
import { PageGuideBanner } from '../../components/ui/PageGuideBanner';
import {
  getAllTrains,
  createTrainMovement,
  updateTrainMovement,
  deleteTrainMovement,
  getAllWindows,
  toggleWindowAvailability,
  getSections,
  createSection,
  deleteSection,
  setupCorridor,
  type TimetableTrain,
  type CorridorWindowFull,
  type Section,
} from '../../lib/apiClient';
import {
  Train,
  Clock,
  Plus,
  Trash2,
  Edit2,
  AlertTriangle,
  Layers,
  MapPin,
  X,
  RefreshCw,
  Zap,
  Info,
} from 'lucide-react';

export default function TrainCorridorData() {
  const [activeTab, setActiveTab] = useState<'sections' | 'trains' | 'windows'>('sections');
  const [sections, setSections] = useState<Section[]>([]);
  const [trains, setTrains] = useState<TimetableTrain[]>([]);
  const [windows, setWindows] = useState<CorridorWindowFull[]>([]);

  // Corridor / Section Modals
  const [corridorModalOpen, setCorridorModalOpen] = useState(false);
  const [corridorNameInput, setCorridorNameInput] = useState('Test Corridor');
  const [corridorStationsInput, setCorridorStationsInput] = useState('A, B, C');
  const [corridorLineType, setCorridorLineType] = useState('double');
  const [corridorElectrified, setCorridorElectrified] = useState(true);

  const [sectionModalOpen, setSectionModalOpen] = useState(false);
  const [sectionFormData, setSectionFormData] = useState({
    name: 'A-B',
    corridor_name: 'Test Corridor',
    from_station: 'A',
    to_station: 'B',
    length_km: 25,
    line_type: 'double' as 'single' | 'double',
    is_electrified: true,
    traction_type: '25 kV AC OHE',
    section_capacity_notes: 'Trunk double line equipped with absolute block signalling',
  });

  // Train Modals
  const [trainModalOpen, setTrainModalOpen] = useState(false);
  const [editingTrain, setEditingTrain] = useState<TimetableTrain | null>(null);
  const [trainFormData, setTrainFormData] = useState({
    train_number: 'P101',
    train_type: 'Passenger',
    section_id: '',
    entry_time: '2026-09-08T00:00:00',
    exit_time: '2026-09-08T00:30:00',
    priority: 2,
    source: 'Manual',
    notes: 'Scheduled passenger rake',
  });

  // Window Unavailability Modal
  const [windowModalOpen, setWindowModalOpen] = useState(false);
  const [targetWindow, setTargetWindow] = useState<CorridorWindowFull | null>(null);
  const [unavailReason, setUnavailReason] = useState('Special VIP / Military train running');

  const loadAll = async () => {
    try {
      const [secData, trainData, winData] = await Promise.all([
        getSections().catch(() => []),
        getAllTrains().catch(() => []),
        getAllWindows().catch(() => []),
      ]);
      setSections(secData);
      setTrains(trainData);
      setWindows(winData);
      if (secData.length > 0 && !trainFormData.section_id) {
        setTrainFormData((prev) => ({ ...prev, section_id: secData[0].id }));
      }
    } catch (err) {
      console.error('Failed to load corridor data:', err);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  // Quick Corridor Setup
  const handleQuickCorridorSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    const stations = corridorStationsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (stations.length < 2) {
      alert('Please specify at least 2 stations separated by commas (e.g. A, B, C)');
      return;
    }

    try {
      await setupCorridor({
        corridor_name: corridorNameInput,
        stations,
        line_type: corridorLineType,
        is_electrified: corridorElectrified,
      });
      setCorridorModalOpen(false);
      await loadAll();
    } catch (err: any) {
      alert(`Failed to set up corridor: ${err.message}`);
    }
  };

  // Add Single Section
  const handleSaveSection = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createSection(sectionFormData);
      setSectionModalOpen(false);
      await loadAll();
    } catch (err: any) {
      alert(`Failed to create section: ${err.message}`);
    }
  };

  // Delete Section
  const handleDeleteSection = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete section "${name}" and all related train movements and windows?`)) {
      return;
    }
    try {
      await deleteSection(id);
      await loadAll();
    } catch (err: any) {
      alert(`Failed to delete section: ${err.message}`);
    }
  };

  // Train Handlers
  const handleOpenAddTrain = () => {
    setEditingTrain(null);
    setTrainFormData({
      train_number: trains.length === 0 ? 'P101' : trains.length === 1 ? 'P102' : `T${trains.length + 100}`,
      train_type: 'Passenger',
      section_id: sections[0]?.id || '',
      entry_time: '2026-09-08T00:00:00',
      exit_time: '2026-09-08T00:30:00',
      priority: 2,
      source: 'Manual',
      notes: '',
    });
    setTrainModalOpen(true);
  };

  const handleOpenEditTrain = (tr: TimetableTrain) => {
    setEditingTrain(tr);
    setTrainFormData({
      train_number: tr.train_number,
      train_type: tr.train_type || 'Passenger',
      section_id: tr.section_id,
      entry_time: tr.entry_time.slice(0, 19),
      exit_time: tr.exit_time.slice(0, 19),
      priority: tr.priority,
      source: tr.source || 'Manual',
      notes: tr.notes || '',
    });
    setTrainModalOpen(true);
  };

  const handleSaveTrain = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingTrain) {
        await updateTrainMovement(editingTrain.id, trainFormData);
      } else {
        await createTrainMovement(trainFormData);
      }
      setTrainModalOpen(false);
      await loadAll();
    } catch (err: any) {
      alert(`Failed to save train movement: ${err.message}`);
    }
  };

  const handleDeleteTrain = async (id: string, number: string) => {
    if (!confirm(`Are you sure you want to delete train movement ${number}?`)) return;
    try {
      await deleteTrainMovement(id);
      await loadAll();
    } catch (err: any) {
      alert(`Failed to delete train movement: ${err.message}`);
    }
  };

  const handleToggleWindow = async (w: CorridorWindowFull) => {
    if (w.is_available) {
      setTargetWindow(w);
      setWindowModalOpen(true);
    } else {
      try {
        await toggleWindowAvailability(w.id, true);
        await loadAll();
      } catch (err: any) {
        alert(`Failed to restore window: ${err.message}`);
      }
    }
  };

  const handleConfirmWindowUnavail = async () => {
    if (!targetWindow) return;
    try {
      await toggleWindowAvailability(targetWindow.id, false, unavailReason);
      setWindowModalOpen(false);
      await loadAll();
    } catch (err: any) {
      alert(`Failed to update window: ${err.message}`);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#F6F8FB] text-[#172033]">
      <TopBar title="Train & Corridor Data" subtitle="Corridor Infrastructure, Timetable Constraints, and Available Block Windows" />

      <main className="p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Page Guide */}
        <PageGuideBanner
          pageTitle="Train & Corridor Data"
          purpose="Configure railway physical corridor sections and train timetable movements. SANGAM automatically computes open possession gaps between train movements to find viable maintenance block windows without conflicting with passenger and freight traffic."
          inputs={['Corridor Name & Station Sequence', 'Track Double/Single Line & Electrification Type', 'Train Movements (Entry & Exit Times, Priorities)']}
          outputs={['Dynamically Computed Candidate Block Windows', 'Corridor Track Infrastructure Schema', 'Train Occupancy Profiles']}
          nextStep={{ label: 'Proceed to Maintenance Work', to: '/maintenance' }}
        />

        {/* Tab Selector & Action Bar */}
        <div className="bg-white rounded-lg border border-[#D9E1EA] p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-1 bg-[#F1F4F9] p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('sections')}
              className={`px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'sections'
                  ? 'bg-white text-[#173F7A] shadow-xs'
                  : 'text-[#667085] hover:text-[#172033]'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Corridor Sections ({sections.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('trains')}
              className={`px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'trains'
                  ? 'bg-white text-[#173F7A] shadow-xs'
                  : 'text-[#667085] hover:text-[#172033]'
              }`}
            >
              <Train className="w-4 h-4" />
              <span>Train Movements ({trains.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('windows')}
              className={`px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'windows'
                  ? 'bg-white text-[#173F7A] shadow-xs'
                  : 'text-[#667085] hover:text-[#172033]'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Candidate Windows ({windows.length})</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'sections' && (
              <>
                <button
                  onClick={() => setCorridorModalOpen(true)}
                  className="px-3.5 py-2 rounded-md bg-[#173F7A] text-white text-xs font-bold hover:bg-[#1E4E8C] transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                  title="Configure corridor stations (e.g. Test Corridor with Stations A, B, C)"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Setup Corridor</span>
                </button>
                <button
                  onClick={() => setSectionModalOpen(true)}
                  className="px-3.5 py-2 rounded-md border border-[#D9E1EA] bg-white text-[#172033] text-xs font-bold hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Add a single railway section"
                >
                  <Plus className="w-3.5 h-3.5 text-[#173F7A]" />
                  <span>Add Section</span>
                </button>
              </>
            )}

            {activeTab === 'trains' && (
              <button
                onClick={handleOpenAddTrain}
                disabled={sections.length === 0}
                className={`px-4 py-2 rounded-md text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs ${
                  sections.length === 0
                    ? 'bg-slate-300 cursor-not-allowed'
                    : 'bg-[#173F7A] hover:bg-[#1E4E8C] cursor-pointer'
                }`}
                title={sections.length === 0 ? 'Create a corridor section first' : 'Add a train movement to calculate gap windows'}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Train Movement</span>
              </button>
            )}

            {activeTab === 'windows' && (
              <button
                onClick={loadAll}
                className="px-3.5 py-2 rounded-md border border-[#D9E1EA] bg-white text-[#172033] text-xs font-bold hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Refresh candidate windows from train movements"
              >
                <RefreshCw className="w-3.5 h-3.5 text-[#173F7A]" />
                <span>Refresh Windows</span>
              </button>
            )}
          </div>
        </div>

        {/* ── TAB 1: CORRIDOR SECTIONS ── */}
        {activeTab === 'sections' && (
          <div className="space-y-6">
            {/* Visual Corridor Overview */}
            {sections.length > 0 ? (
              <div className="bg-white rounded-lg border border-[#D9E1EA] p-5 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-[#D9E1EA] mb-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#173F7A]" />
                    <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-[#172033]">
                      Corridor Infrastructure Schematic
                    </h3>
                  </div>
                  <span className="text-xs font-mono text-[#667085]">
                    {sections[0]?.corridor_name || 'Railway Corridor'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {sections.map((sec) => {
                    const secTrains = trains.filter((t) => t.section_id === sec.id);
                    const secWindows = windows.filter((w) => w.section_id === sec.id);
                    return (
                      <div
                        key={sec.id}
                        className="p-4 rounded-lg border border-[#D9E1EA] bg-[#F8FAFC] hover:border-[#173F7A] transition-all relative group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold text-[#173F7A] bg-[#EBF2FA] px-2 py-0.5 rounded">
                            {sec.name}
                          </span>
                          <button
                            onClick={() => handleDeleteSection(sec.id, sec.name)}
                            className="text-slate-400 hover:text-red-600 p-1 rounded transition-colors"
                            title="Delete this section"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="text-sm font-bold text-[#172033] mt-2">
                          {sec.from_station} → {sec.to_station}
                        </div>

                        <div className="text-[11px] text-[#667085] mt-1 space-y-0.5">
                          <div>Distance: <strong className="text-[#172033] font-mono">{sec.length_km || 25} km</strong></div>
                          <div>Track: <strong className="text-[#172033] capitalize">{sec.line_type || 'double'} line</strong></div>
                          <div className="flex items-center gap-1 text-emerald-700">
                            <Zap className="w-3 h-3 text-emerald-600" />
                            <span>{sec.is_electrified ? '25 kV AC OHE' : 'Non-electrified'}</span>
                          </div>
                        </div>

                        <div className="mt-3 pt-2.5 border-t border-slate-200 flex items-center justify-between text-xs font-mono">
                          <span className="text-[#667085]">{secTrains.length} trains</span>
                          <span className="text-emerald-700 font-bold">{secWindows.length} windows</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-[#D9E1EA] p-10 text-center shadow-xs">
                <div className="w-12 h-12 rounded-full bg-blue-50 text-[#173F7A] flex items-center justify-center mx-auto mb-3">
                  <Layers className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-[#172033]">No corridor sections defined</h3>
                <p className="text-xs text-[#667085] max-w-md mx-auto mt-1 leading-relaxed">
                  Start by clicking <strong>Setup Corridor</strong> to create your test route (e.g. Corridor: <em>Test Corridor</em>, Stations: <em>A, B, C</em>) which generates sections A-B and B-C.
                </p>
                <button
                  onClick={() => setCorridorModalOpen(true)}
                  className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#173F7A] text-white text-xs font-bold hover:bg-[#1E4E8C] transition-colors shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Setup Test Corridor (Stations A, B, C)</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: TRAIN MOVEMENTS ── */}
        {activeTab === 'trains' && (
          <div className="space-y-4">
            {/* Helper Banner */}
            <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 flex items-start gap-3">
              <Info className="w-4 h-4 text-[#173F7A] flex-shrink-0 mt-0.5" />
              <div className="text-xs text-[#172033] leading-relaxed">
                <strong>How Train Movements Impact Maintenance:</strong> Train movements determine when a railway section is occupied and when maintenance blocks may be possible. Gaps between trains (with mandatory safety buffers) become the candidate windows for Engineering, TRD, and S&T possessions.
              </div>
            </div>

            {/* Train List */}
            {trains.length > 0 ? (
              <div className="bg-white rounded-lg border border-[#D9E1EA] shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#F8FAFC] border-b border-[#D9E1EA] text-[#667085] font-mono uppercase text-[11px]">
                      <tr>
                        <th className="py-3 px-4">Train No / ID</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4">Section</th>
                        <th className="py-3 px-4">Entry Time</th>
                        <th className="py-3 px-4">Exit Time</th>
                        <th className="py-3 px-4">Priority</th>
                        <th className="py-3 px-4">Source</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D9E1EA]">
                      {trains.map((tr) => (
                        <tr key={tr.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-[#172033]">
                            {tr.train_number}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              tr.train_type === 'Passenger' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {tr.train_type || 'Passenger'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-[#172033]">
                            {tr.section_name || 'Section'}
                          </td>
                          <td className="py-3 px-4 font-mono text-[#667085]">
                            {new Date(tr.entry_time).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-3 px-4 font-mono text-[#667085]">
                            {new Date(tr.exit_time).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-3 px-4 font-mono font-semibold text-[#172033]">
                            P{tr.priority}
                          </td>
                          <td className="py-3 px-4 text-[#667085]">
                            {tr.source || 'Manual'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleOpenEditTrain(tr)}
                                className="p-1 hover:bg-slate-100 text-slate-600 rounded transition-colors"
                                title="Edit train movement"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteTrain(tr.id, tr.train_number)}
                                className="p-1 hover:bg-red-50 text-red-600 rounded transition-colors"
                                title="Delete train movement"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-[#D9E1EA] p-10 text-center shadow-xs">
                <div className="w-12 h-12 rounded-full bg-blue-50 text-[#173F7A] flex items-center justify-center mx-auto mb-3">
                  <Train className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-[#172033]">No train movements scheduled</h3>
                <p className="text-xs text-[#667085] max-w-md mx-auto mt-1 leading-relaxed">
                  Add trains on your sections (e.g. Passenger P101 00:00–00:30, P102 04:00–04:30 on Section B-C).
                  SANGAM will automatically detect the gap between P101 and P102 as a candidate block window.
                </p>
                <button
                  onClick={handleOpenAddTrain}
                  disabled={sections.length === 0}
                  className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#173F7A] text-white text-xs font-bold hover:bg-[#1E4E8C] transition-colors shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add First Train Movement</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 3: CANDIDATE WINDOWS ── */}
        {activeTab === 'windows' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-[#667085]">
              <span>
                Computed from gaps between train timetable movements. Green windows are open for block scheduling.
              </span>
              <span className="font-mono font-bold text-[#172033]">
                Total: {windows.length} windows ({windows.filter((w) => w.is_available).length} available)
              </span>
            </div>

            {windows.length > 0 ? (
              <div className="bg-white rounded-lg border border-[#D9E1EA] shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#F8FAFC] border-b border-[#D9E1EA] text-[#667085] font-mono uppercase text-[11px]">
                      <tr>
                        <th className="py-3 px-4">Section</th>
                        <th className="py-3 px-4">Window Time Interval</th>
                        <th className="py-3 px-4">Duration</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Notes / Restrictions</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D9E1EA]">
                      {windows.map((w) => (
                        <tr key={w.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-[#172033]">
                            {w.section_name}
                          </td>
                          <td className="py-3 px-4 font-mono text-[#172033]">
                            {new Date(w.window_start).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} ·{' '}
                            {new Date(w.window_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
                            {new Date(w.window_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-[#173F7A]">
                            {w.duration_min} min
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              w.is_available ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {w.is_available ? 'Available' : 'Unavailable'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-[#667085]">
                            {w.is_available ? 'Normal traffic clearance' : w.unavailability_reason || 'Marked unavailable'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleToggleWindow(w)}
                              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                                w.is_available
                                  ? 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                              }`}
                              title={w.is_available ? 'Prevent optimizer from using this window' : 'Restore window for scheduling'}
                            >
                              {w.is_available ? 'Mark Unavailable' : 'Restore Available'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-[#D9E1EA] p-10 text-center shadow-xs">
                <div className="w-12 h-12 rounded-full bg-blue-50 text-[#173F7A] flex items-center justify-center mx-auto mb-3">
                  <Clock className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-[#172033]">No candidate windows computed</h3>
                <p className="text-xs text-[#667085] max-w-md mx-auto mt-1 leading-relaxed">
                  Candidate windows are created from the gaps between your train movements.
                  Add trains on your sections in the <strong>Train Movements</strong> tab to automatically compute available possession windows.
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── MODAL: SETUP CORRIDOR ── */}
      {corridorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-[#D9E1EA] rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#D9E1EA] pb-3">
              <h2 className="text-base font-bold text-[#172033] flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#173F7A]" />
                Setup Railway Corridor
              </h2>
              <button onClick={() => setCorridorModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleQuickCorridorSetup} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#172033] mb-1">Corridor Name *</label>
                <input
                  type="text"
                  required
                  value={corridorNameInput}
                  onChange={(e) => setCorridorNameInput(e.target.value)}
                  placeholder="e.g. Test Corridor"
                  className="w-full bg-[#F8FAFC] border border-[#D9E1EA] rounded p-2 text-[#172033] focus:outline-none focus:border-[#173F7A]"
                />
                <span className="text-[11px] text-[#667085] mt-0.5 block">Identifies this railway operational corridor.</span>
              </div>

              <div>
                <label className="block font-semibold text-[#172033] mb-1">Stations (Ordered, comma-separated) *</label>
                <input
                  type="text"
                  required
                  value={corridorStationsInput}
                  onChange={(e) => setCorridorStationsInput(e.target.value)}
                  placeholder="e.g. A, B, C"
                  className="w-full bg-[#F8FAFC] border border-[#D9E1EA] rounded p-2 text-[#172033] focus:outline-none focus:border-[#173F7A] font-mono"
                />
                <span className="text-[11px] text-[#667085] mt-0.5 block">Example: <code>A, B, C</code> will automatically create sections A-B and B-C.</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#172033] mb-1">Track Type</label>
                  <select
                    value={corridorLineType}
                    onChange={(e) => setCorridorLineType(e.target.value)}
                    className="w-full bg-[#F8FAFC] border border-[#D9E1EA] rounded p-2 text-[#172033] focus:outline-none focus:border-[#173F7A]"
                  >
                    <option value="double">Double Line</option>
                    <option value="single">Single Line</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#172033] mb-1">Traction</label>
                  <select
                    value={corridorElectrified ? 'yes' : 'no'}
                    onChange={(e) => setCorridorElectrified(e.target.value === 'yes')}
                    className="w-full bg-[#F8FAFC] border border-[#D9E1EA] rounded p-2 text-[#172033] focus:outline-none focus:border-[#173F7A]"
                  >
                    <option value="yes">Electrified (25kV AC)</option>
                    <option value="no">Non-Electrified</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#D9E1EA]">
                <button
                  type="button"
                  onClick={() => setCorridorModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#173F7A] hover:bg-[#1E4E8C] text-white rounded font-bold text-xs shadow-xs"
                >
                  Create Corridor & Sections
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: ADD INDIVIDUAL SECTION ── */}
      {sectionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-[#D9E1EA] rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#D9E1EA] pb-3">
              <h2 className="text-base font-bold text-[#172033] flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#173F7A]" />
                Add Railway Section
              </h2>
              <button onClick={() => setSectionModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSection} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#172033] mb-1">From Station *</label>
                  <input
                    type="text"
                    required
                    value={sectionFormData.from_station}
                    onChange={(e) => {
                      const from = e.target.value;
                      setSectionFormData({ ...sectionFormData, from_station: from, name: `${from}-${sectionFormData.to_station}` });
                    }}
                    className="w-full bg-[#F8FAFC] border border-[#D9E1EA] rounded p-2 text-[#172033] focus:outline-none focus:border-[#173F7A]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#172033] mb-1">To Station *</label>
                  <input
                    type="text"
                    required
                    value={sectionFormData.to_station}
                    onChange={(e) => {
                      const to = e.target.value;
                      setSectionFormData({ ...sectionFormData, to_station: to, name: `${sectionFormData.from_station}-${to}` });
                    }}
                    className="w-full bg-[#F8FAFC] border border-[#D9E1EA] rounded p-2 text-[#172033] focus:outline-none focus:border-[#173F7A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#172033] mb-1">Section Identifier *</label>
                  <input
                    type="text"
                    required
                    value={sectionFormData.name}
                    onChange={(e) => setSectionFormData({ ...sectionFormData, name: e.target.value })}
                    className="w-full bg-[#F8FAFC] border border-[#D9E1EA] rounded p-2 text-[#172033] focus:outline-none focus:border-[#173F7A] font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#172033] mb-1">Distance (km) *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={sectionFormData.length_km}
                    onChange={(e) => setSectionFormData({ ...sectionFormData, length_km: parseFloat(e.target.value) || 25 })}
                    className="w-full bg-[#F8FAFC] border border-[#D9E1EA] rounded p-2 text-[#172033] focus:outline-none focus:border-[#173F7A] font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#172033] mb-1">Line Type</label>
                  <select
                    value={sectionFormData.line_type}
                    onChange={(e) => setSectionFormData({ ...sectionFormData, line_type: e.target.value as 'single' | 'double' })}
                    className="w-full bg-[#F8FAFC] border border-[#D9E1EA] rounded p-2 text-[#172033] focus:outline-none focus:border-[#173F7A]"
                  >
                    <option value="double">Double Line</option>
                    <option value="single">Single Line</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#172033] mb-1">Electrified</label>
                  <select
                    value={sectionFormData.is_electrified ? 'yes' : 'no'}
                    onChange={(e) => setSectionFormData({ ...sectionFormData, is_electrified: e.target.value === 'yes' })}
                    className="w-full bg-[#F8FAFC] border border-[#D9E1EA] rounded p-2 text-[#172033] focus:outline-none focus:border-[#173F7A]"
                  >
                    <option value="yes">Yes (25kV AC OHE)</option>
                    <option value="no">No</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#172033] mb-1">Corridor Name</label>
                <input
                  type="text"
                  value={sectionFormData.corridor_name}
                  onChange={(e) => setSectionFormData({ ...sectionFormData, corridor_name: e.target.value })}
                  className="w-full bg-[#F8FAFC] border border-[#D9E1EA] rounded p-2 text-[#172033] focus:outline-none focus:border-[#173F7A]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#D9E1EA]">
                <button
                  type="button"
                  onClick={() => setSectionModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#173F7A] hover:bg-[#1E4E8C] text-white rounded font-bold text-xs shadow-xs"
                >
                  Save Section
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: ADD / EDIT TRAIN MOVEMENT ── */}
      {trainModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-[#D9E1EA] rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#D9E1EA] pb-3">
              <h2 className="text-base font-bold text-[#172033] flex items-center gap-2">
                <Train className="w-5 h-5 text-[#173F7A]" />
                {editingTrain ? 'Edit Train Movement' : 'Add Train Movement'}
              </h2>
              <button onClick={() => setTrainModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTrain} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#172033] mb-1">Train Identifier / Number *</label>
                  <input
                    type="text"
                    required
                    value={trainFormData.train_number}
                    onChange={(e) => setTrainFormData({ ...trainFormData, train_number: e.target.value })}
                    placeholder="e.g. P101, P102, G201"
                    className="w-full bg-[#F8FAFC] border border-[#D9E1EA] rounded p-2 text-[#172033] focus:outline-none focus:border-[#173F7A] font-mono font-bold"
                  />
                  <span className="text-[10px] text-[#667085] mt-0.5 block">Unique train or freight rake ID</span>
                </div>

                <div>
                  <label className="block font-semibold text-[#172033] mb-1">Service Type *</label>
                  <select
                    value={trainFormData.train_type}
                    onChange={(e) => setTrainFormData({ ...trainFormData, train_type: e.target.value })}
                    className="w-full bg-[#F8FAFC] border border-[#D9E1EA] rounded p-2 text-[#172033] focus:outline-none focus:border-[#173F7A]"
                  >
                    <option value="Passenger">Passenger Train</option>
                    <option value="Goods">Goods / Freight Rake</option>
                  </select>
                  <span className="text-[10px] text-[#667085] mt-0.5 block">Passenger or Freight</span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#172033] mb-1">Corridor Section *</label>
                <select
                  required
                  value={trainFormData.section_id}
                  onChange={(e) => setTrainFormData({ ...trainFormData, section_id: e.target.value })}
                  className="w-full bg-[#F8FAFC] border border-[#D9E1EA] rounded p-2 text-[#172033] focus:outline-none focus:border-[#173F7A] font-mono"
                >
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.from_station} → {s.to_station})
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-[#667085] mt-0.5 block">Where this train traverses</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#172033] mb-1">Entry Date & Time *</label>
                  <input
                    type="datetime-local"
                    required
                    value={trainFormData.entry_time}
                    onChange={(e) => setTrainFormData({ ...trainFormData, entry_time: e.target.value })}
                    className="w-full bg-[#F8FAFC] border border-[#D9E1EA] rounded p-2 text-[#172033] focus:outline-none focus:border-[#173F7A] font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#172033] mb-1">Exit Date & Time *</label>
                  <input
                    type="datetime-local"
                    required
                    value={trainFormData.exit_time}
                    onChange={(e) => setTrainFormData({ ...trainFormData, exit_time: e.target.value })}
                    className="w-full bg-[#F8FAFC] border border-[#D9E1EA] rounded p-2 text-[#172033] focus:outline-none focus:border-[#173F7A] font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#172033] mb-1">Priority</label>
                  <select
                    value={trainFormData.priority}
                    onChange={(e) => setTrainFormData({ ...trainFormData, priority: parseInt(e.target.value) })}
                    className="w-full bg-[#F8FAFC] border border-[#D9E1EA] rounded p-2 text-[#172033] focus:outline-none focus:border-[#173F7A]"
                  >
                    <option value={1}>Priority 1 (Premium / Express)</option>
                    <option value={2}>Priority 2 (Standard Passenger)</option>
                    <option value={3}>Priority 3 (Goods / Freight)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#172033] mb-1">Source</label>
                  <input
                    type="text"
                    value={trainFormData.source}
                    onChange={(e) => setTrainFormData({ ...trainFormData, source: e.target.value })}
                    className="w-full bg-[#F8FAFC] border border-[#D9E1EA] rounded p-2 text-[#172033] focus:outline-none focus:border-[#173F7A]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#172033] mb-1">Operational Notes</label>
                <input
                  type="text"
                  value={trainFormData.notes}
                  onChange={(e) => setTrainFormData({ ...trainFormData, notes: e.target.value })}
                  placeholder="Optional operational remarks..."
                  className="w-full bg-[#F8FAFC] border border-[#D9E1EA] rounded p-2 text-[#172033] focus:outline-none focus:border-[#173F7A]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#D9E1EA]">
                <button
                  type="button"
                  onClick={() => setTrainModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#173F7A] hover:bg-[#1E4E8C] text-white rounded font-bold text-xs shadow-xs"
                >
                  Save Train Movement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: MARK WINDOW UNAVAILABLE ── */}
      {windowModalOpen && targetWindow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-[#D9E1EA] rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#D9E1EA] pb-3">
              <h2 className="text-base font-bold text-[#172033] flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Mark Window Unavailable
              </h2>
              <button onClick={() => setWindowModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#667085] leading-relaxed">
              Marking window on <strong className="text-[#172033]">{targetWindow.section_name}</strong> ({targetWindow.duration_min} min) as unavailable will prevent the optimizer from placing any blocks in this interval.
            </p>

            <div>
              <label className="block text-xs font-semibold text-[#172033] mb-1">Reason for Unavailability *</label>
              <select
                value={unavailReason}
                onChange={(e) => setUnavailReason(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-[#D9E1EA] rounded p-2 text-[#172033] focus:outline-none focus:border-[#173F7A] text-xs mb-2"
              >
                <option value="Special VIP / Military train running">Special VIP / Military train running</option>
                <option value="Track already under temporary speed restriction (TSR)">Track already under temporary speed restriction (TSR)</option>
                <option value="Sub-station / OHE maintenance in adjacent zone">Sub-station / OHE maintenance in adjacent zone</option>
                <option value="Controller operational hold">Controller operational hold</option>
              </select>
              <input
                type="text"
                value={unavailReason}
                onChange={(e) => setUnavailReason(e.target.value)}
                placeholder="Or specify custom reason..."
                className="w-full bg-[#F8FAFC] border border-[#D9E1EA] rounded p-2 text-[#172033] focus:outline-none focus:border-[#173F7A] text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#D9E1EA]">
              <button
                onClick={() => setWindowModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmWindowUnavail}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-bold text-xs shadow-xs"
              >
                Confirm Unavailable
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
