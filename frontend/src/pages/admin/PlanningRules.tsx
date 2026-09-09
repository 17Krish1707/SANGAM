import React, { useState, useEffect } from 'react';
import TopBar from '../../components/TopBar';
import { PageGuideBanner } from '../../components/ui/PageGuideBanner';
import {
  getPlanningRules,
  updatePlanningRules,
  resetPlanningRules,
  resetOperationalDatabase,
  initializeStandardDataset,
} from '../../lib/apiClient';
import {
  ShieldAlert,
  Sliders,
  CheckCircle2,
  RotateCcw,
  Save,
  AlertTriangle,
  Database,
  Trash2,
  PlayCircle,
  X,
} from 'lucide-react';

export default function PlanningRules() {
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [resettingDb, setResettingDb] = useState(false);
  const [loadingInit, setLoadingInit] = useState(false);
  const [initModalOpen, setInitModalOpen] = useState(false);
  const [dbNotice, setDbNotice] = useState<string | null>(null);

  const [formState, setFormState] = useState({
    min_train_buffer_min: 15,
    min_block_duration_min: 120,
    power_isolation_requires_dual_track: true,
    crew_rest_period_hours: 8,
    prioritize_overdue_weight: 'High',
    cluster_same_section_weight: 'High',
    avoid_peak_hours: 'Medium',
    plan_stability_weight: 'Very High',
  });

  const loadRules = async () => {
    try {
      const data = await getPlanningRules();
      if (data.hard_rules && data.planning_preferences) {
        setFormState({
          min_train_buffer_min: data.hard_rules.min_train_buffer_min?.value ?? 15,
          min_block_duration_min: data.hard_rules.min_block_duration_min?.value ?? 120,
          power_isolation_requires_dual_track: data.hard_rules.power_isolation_requires_dual_track?.value ?? true,
          crew_rest_period_hours: data.hard_rules.crew_rest_period_hours?.value ?? 8,
          prioritize_overdue_weight: data.planning_preferences.prioritize_overdue_weight?.value ?? 'High',
          cluster_same_section_weight: data.planning_preferences.cluster_same_section_weight?.value ?? 'High',
          avoid_peak_hours: data.planning_preferences.avoid_peak_hours?.value ?? 'Medium',
          plan_stability_weight: data.planning_preferences.plan_stability_weight?.value ?? 'Very High',
        });
      }
    } catch (err) {
      console.error('Failed loading planning rules:', err);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updatePlanningRules({
        hard_rules: {
          min_train_buffer_min: formState.min_train_buffer_min,
          min_block_duration_min: formState.min_block_duration_min,
          power_isolation_requires_dual_track: formState.power_isolation_requires_dual_track,
          crew_rest_period_hours: formState.crew_rest_period_hours,
        },
        planning_preferences: {
          prioritize_overdue_weight: formState.prioritize_overdue_weight,
          cluster_same_section_weight: formState.cluster_same_section_weight,
          avoid_peak_hours: formState.avoid_peak_hours,
          plan_stability_weight: formState.plan_stability_weight,
        },
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
      loadRules();
    } catch (err: any) {
      alert(`Failed saving rules: ${err.message || err}`);
    } finally {
      setSaving(false);
    }
  };

  const handleResetRules = async () => {
    if (!confirm('Reset all planning rules to standard Indian Railways Railway Board guidelines?')) return;
    try {
      await resetPlanningRules();
      loadRules();
    } catch (err: any) {
      alert(`Failed resetting rules: ${err.message || err}`);
    }
  };

  const handleResetOperationalDb = async (keepSections: boolean) => {
    const confirmation = prompt(
      `DEVELOPER ACTION: Type "RESET" to purge all operational records (tasks, trains, windows, resources, and blocks). Schema & departments will remain intact.`
    );
    if (confirmation !== 'RESET') return;

    setResettingDb(true);
    try {
      const res = await resetOperationalDatabase(keepSections);
      setDbNotice(res.message);
      setTimeout(() => setDbNotice(null), 5000);
    } catch (err: any) {
      alert(`Failed to reset operational database: ${err.message || err}`);
    } finally {
      setResettingDb(false);
    }
  };

  const handleInitializeDataset = async () => {
    setLoadingInit(true);
    try {
      const res = await initializeStandardDataset();
      setDbNotice(res.message);
      setInitModalOpen(false);
      setTimeout(() => setDbNotice(null), 6000);
    } catch (err: any) {
      alert(`Failed to initialize standard dataset: ${err.message || err}`);
    } finally {
      setLoadingInit(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#F6F8FB] text-[#172033]">
      <TopBar title="Planning Rules" subtitle="Divisional Operating Guidelines, Safety Isolation Thresholds, and Solver Objective Weighting" />

      <main className="p-6 max-w-5xl mx-auto w-full space-y-6">
        {/* Page Guide Banner */}
        <PageGuideBanner
          pageTitle="Planning Rules & Admin"
          purpose="Configure statutory railway operating parameters and objective optimization weights governing the SANGAM CP-SAT solver. Rules control train headways, power cut dual track boundaries, crew rest requirements, and joint bundling weights."
          inputs={['Train Headway Margin (min)', 'Min Block Window Duration', 'Power Cut Protocol', 'Crew Rest Period', 'Optimization Multi-Objective Weights']}
          outputs={['Updated Solver Bounds', 'Statutory Compliance Settings', 'RDSO Baseline Rules']}
          nextStep={{ label: 'Configure Block Plan in Create Block Plan', to: '/planning/create' }}
        />

        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-[#D9E1EA] shadow-xs">
          <div>
            <h1 className="text-xl font-bold text-[#172033] flex items-center gap-2">
              <Sliders className="w-5 h-5 text-[#173F7A]" />
              <span>Railway Planning Rules & Safety Enforcements</span>
            </h1>
            <p className="text-xs text-[#667085] mt-1">
              Configure divisional operating guidelines, safety isolation thresholds, and solver objective weighting.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleResetRules}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-md font-semibold text-xs flex items-center gap-1.5 transition-colors border border-[#D9E1EA] cursor-pointer"
              title="Restore standard RDSO defaults"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#173F7A]" />
              <span>Reset to IR Defaults</span>
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-[#173F7A] hover:bg-[#1E4E8C] text-white rounded-md font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save Rule Configuration'}</span>
            </button>
          </div>
        </div>

        {saveSuccess && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2 text-xs text-[#173F7A] font-semibold animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Rule configuration updated successfully. Subsequent optimization runs will adhere to these parameters.</span>
          </div>
        )}

        {dbNotice && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-xs text-amber-800 font-semibold animate-in fade-in">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>{dbNotice}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {/* HARD RULES */}
          <div className="bg-white border border-[#D9E1EA] rounded-xl p-6 space-y-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-[#D9E1EA] pb-3">
              <div className="flex items-center gap-2 text-[#172033] font-bold text-sm">
                <ShieldAlert className="w-5 h-5 text-red-600" />
                <span>Hard Operating Rules (Non-Negotiable Safety Constraints)</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-red-100 text-red-800 rounded-full">
                Mathematical Hard Constraints
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Buffer after passenger train */}
              <div className="p-4 bg-[#F8FAFC] border border-[#D9E1EA] rounded-lg space-y-2">
                <div className="flex justify-between items-center">
                  <label className="font-semibold text-[#172033]">Minimum Buffer Post-Train Passage</label>
                  <span className="font-mono text-[#173F7A] font-bold">{formState.min_train_buffer_min} min</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={30}
                  step={5}
                  value={formState.min_train_buffer_min}
                  onChange={(e) => setFormState({ ...formState, min_train_buffer_min: parseInt(e.target.value) })}
                  className="w-full accent-[#173F7A]"
                />
                <p className="text-[11px] text-[#667085]">
                  Safety buffer required between the passage of a scheduled passenger train and commencement of track possession.
                </p>
              </div>

              {/* Minimum continuous block duration */}
              <div className="p-4 bg-[#F8FAFC] border border-[#D9E1EA] rounded-lg space-y-2">
                <div className="flex justify-between items-center">
                  <label className="font-semibold text-[#172033]">Minimum Continuous Block Window</label>
                  <span className="font-mono text-[#173F7A] font-bold">{formState.min_block_duration_min} min ({Math.round((formState.min_block_duration_min / 60) * 10) / 10} hrs)</span>
                </div>
                <input
                  type="range"
                  min={60}
                  max={240}
                  step={30}
                  value={formState.min_block_duration_min}
                  onChange={(e) => setFormState({ ...formState, min_block_duration_min: parseInt(e.target.value) })}
                  className="w-full accent-[#173F7A]"
                />
                <p className="text-[11px] text-[#667085]">
                  Heavy track machines (TTM/BCM) require at least this continuous duration for machine setup, tamping, and clearing.
                </p>
              </div>

              {/* Power isolation rule */}
              <div className="p-4 bg-[#F8FAFC] border border-[#D9E1EA] rounded-lg space-y-2">
                <div className="flex justify-between items-center">
                  <label className="font-semibold text-[#172033]">Power Isolation Dual Track Shutdown</label>
                  <input
                    type="checkbox"
                    checked={formState.power_isolation_requires_dual_track}
                    onChange={(e) => setFormState({ ...formState, power_isolation_requires_dual_track: e.target.checked })}
                    className="w-4 h-4 accent-[#173F7A] rounded cursor-pointer"
                  />
                </div>
                <p className="text-[11px] text-[#667085]">
                  When OHE power isolation is activated on single-cantilever or shared gantry sections, require traction isolation on adjacent track.
                </p>
              </div>

              {/* Crew rest period */}
              <div className="p-4 bg-[#F8FAFC] border border-[#D9E1EA] rounded-lg space-y-2">
                <div className="flex justify-between items-center">
                  <label className="font-semibold text-[#172033]">Mandatory Crew Rest Between Blocks</label>
                  <span className="font-mono text-[#173F7A] font-bold">{formState.crew_rest_period_hours} hours</span>
                </div>
                <input
                  type="range"
                  min={4}
                  max={12}
                  step={1}
                  value={formState.crew_rest_period_hours}
                  onChange={(e) => setFormState({ ...formState, crew_rest_period_hours: parseInt(e.target.value) })}
                  className="w-full accent-[#173F7A]"
                />
                <p className="text-[11px] text-[#667085]">
                  Statutory rest interval prescribed under Hours of Employment Regulations (HOER) for engineering and machine operators.
                </p>
              </div>
            </div>
          </div>

          {/* PLANNING PREFERENCES */}
          <div className="bg-white border border-[#D9E1EA] rounded-xl p-6 space-y-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-[#D9E1EA] pb-3">
              <div className="flex items-center gap-2 text-[#172033] font-bold text-sm">
                <Sliders className="w-5 h-5 text-[#173F7A]" />
                <span>Planning Preferences (Solver Objective Weighting)</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-[#173F7A] rounded-full">
                Multi-Objective Optimization Weights
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-[#F8FAFC] border border-[#D9E1EA] rounded-lg space-y-2">
                <label className="block font-semibold text-[#172033]">Prioritize Overdue & Critical Tasks</label>
                <select
                  value={formState.prioritize_overdue_weight}
                  onChange={(e) => setFormState({ ...formState, prioritize_overdue_weight: e.target.value })}
                  className="w-full bg-white border border-[#D9E1EA] rounded p-2 text-[#172033] focus:outline-none focus:border-[#173F7A] text-xs font-medium"
                >
                  <option value="Critical">Critical Priority (Zero Tolerance for Overdue)</option>
                  <option value="High">High Priority (Standard IR Default)</option>
                  <option value="Medium">Medium Priority</option>
                </select>
                <p className="text-[11px] text-[#667085]">
                  Multiplier penalizing delay of maintenance jobs nearing statutory safety expiration.
                </p>
              </div>

              <div className="p-4 bg-[#F8FAFC] border border-[#D9E1EA] rounded-lg space-y-2">
                <label className="block font-semibold text-[#172033]">Joint Packaging Preference</label>
                <select
                  value={formState.cluster_same_section_weight}
                  onChange={(e) => setFormState({ ...formState, cluster_same_section_weight: e.target.value })}
                  className="w-full bg-white border border-[#D9E1EA] rounded p-2 text-[#172033] focus:outline-none focus:border-[#173F7A] text-xs font-medium"
                >
                  <option value="Very High">Very High (Aggressively combine multi-dept work)</option>
                  <option value="High">High (Preferred whenever feasible)</option>
                  <option value="Low">Low (Individual department windows allowed)</option>
                </select>
                <p className="text-[11px] text-[#667085]">
                  Incentive reward given to CP-SAT solver for packing Engineering, TRD, and S&T tasks into the same possession.
                </p>
              </div>
            </div>
          </div>

          {/* DEVELOPER DATA MAINTENANCE ACTION */}
          <div className="bg-white border border-[#D9E1EA] rounded-xl p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-[#D9E1EA] pb-3">
              <div className="flex items-center gap-2 text-[#172033] font-bold text-sm">
                <Database className="w-5 h-5 text-indigo-600" />
                <span>Dataset Management & Operational Records</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-full">
                Operational Database Controls
              </span>
            </div>

            {dbNotice && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{dbNotice}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              {/* Load Standard Operational Dataset Card */}
              <div className="p-4 rounded-lg border border-indigo-200 bg-indigo-50/50 space-y-2.5">
                <div className="flex items-center gap-2 text-indigo-900 font-bold text-xs">
                  <Database className="w-4 h-4 text-indigo-600" />
                  <span>Initialize Standard Corridor Dataset</span>
                </div>
                <p className="text-[11px] text-indigo-950/80 leading-relaxed">
                  Populates standard corridor records including 3 double-line sections, scheduled train movements, departmental maintenance demands (ENG, S&T, TRD), physical machinery resources, and solver block windows.
                </p>
                <button
                  type="button"
                  disabled={loadingInit || resettingDb}
                  onClick={() => setInitModalOpen(true)}
                  className="w-full mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-colors disabled:opacity-50"
                >
                  <PlayCircle className="w-3.5 h-3.5" />
                  <span>{loadingInit ? 'Initializing Data...' : 'Initialize Standard Dataset'}</span>
                </button>
              </div>

              {/* Reset Operational Data Card */}
              <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/70 space-y-2.5">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                  <Trash2 className="w-4 h-4 text-red-600" />
                  <span>Reset All Operational Data</span>
                </div>
                <p className="text-[11px] text-[#667085] leading-relaxed">
                  Purges all operational records (tasks, trains, windows, resources, and blocks) in FK-safe order while retaining the schema, configuration rules, and department masters for clean manual setup.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={resettingDb || loadingInit}
                    onClick={() => handleResetOperationalDb(false)}
                    className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-colors disabled:opacity-50"
                  >
                    <span>{resettingDb ? 'Purging...' : 'Reset All (Empty)'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={resettingDb || loadingInit}
                    onClick={() => handleResetOperationalDb(true)}
                    className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-[#D9E1EA] rounded-md font-semibold text-xs cursor-pointer transition-colors disabled:opacity-50"
                  >
                    <span>Keep Sections</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>

        {/* Confirmation Modal for Initialize Standard Dataset */}
        {initModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-[#D9E1EA] p-6 space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-[#D9E1EA] pb-3">
                <div className="flex items-center gap-2 font-bold text-sm text-[#172033]">
                  <Database className="w-5 h-5 text-indigo-600" />
                  <span>Initialize Standard Corridor Dataset</span>
                </div>
                <button
                  type="button"
                  onClick={() => setInitModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-[#667085]">
                <p className="leading-relaxed">
                  This will synchronize and populate standard operational records across the corridor (sections, train timetables, departmental maintenance demands, resources, and candidate block windows).
                </p>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <span className="font-medium">
                    Current operational tasks and schedules will be synchronized to the divisional corridor baseline.
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#D9E1EA]">
                <button
                  type="button"
                  disabled={loadingInit}
                  onClick={() => setInitModalOpen(false)}
                  className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-[#D9E1EA] rounded-md font-semibold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={loadingInit}
                  onClick={handleInitializeDataset}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <PlayCircle className="w-3.5 h-3.5" />
                  <span>{loadingInit ? 'Initializing...' : 'Initialize Dataset'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

