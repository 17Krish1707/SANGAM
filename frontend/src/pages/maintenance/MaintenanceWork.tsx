import { useEffect, useState, useMemo } from 'react';
import TopBar from '../../components/TopBar';
import WorkflowBar from '../../components/WorkflowBar';
import MaintenanceModal from '../../components/maintenance/MaintenanceModal';
import { PageGuideBanner } from '../../components/ui/PageGuideBanner';
import { usePlanning } from '../../context/PlanningContext';
import {
  getTasks,
  deleteTask,
  duplicateTask,
  deferTask,
  completeTask,
  getTaskIntelligence,
  importCsvTasks,
  type MaintenanceTask,
  type TaskIntelligence,
} from '../../lib/apiClient';
import {
  Plus,
  Search,
  Download,
  Upload,
  AlertOctagon,
  CheckCircle2,
  Trash2,
  Copy,
  X,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Zap,
} from 'lucide-react';

export default function MaintenanceWork() {
  const { sections, setWorkflowStage } = usePlanning();

  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedSection, setSelectedSection] = useState('ALL');
  const [selectedSeverity, setSelectedSeverity] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedPowerCut, setSelectedPowerCut] = useState('ALL');

  // Modals & Drawers
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEmergencyModal, setIsEmergencyModal] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<MaintenanceTask | null>(null);

  // Selected row for Detail Drawer
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskDetail, setTaskDetail] = useState<TaskIntelligence | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'details' | 'planning' | 'compatibility'>('details');
  const [showPriorityExplainer, setShowPriorityExplainer] = useState(false);

  // Action Modals (Defer, Complete, Delete, Import CSV)
  const [deferModalOpen, setDeferModalOpen] = useState(false);
  const [deferReason, setDeferReason] = useState('Track Machine Deployment Delayed');
  const [deferDate, setDeferDate] = useState('');

  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [completeNote, setCompleteNote] = useState('Certified by Section Engineer (P-Way)');

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importCsvText, setImportCsvText] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const fetchTasks = async () => {
    setIsLoading(true);
    try {
      const data = await getTasks();
      setTasks(data);
    } catch (err) {
      console.error('Failed to load maintenance tasks:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setWorkflowStage(1);
    fetchTasks();
  }, [setWorkflowStage]);

  // Fetch task detail when row selected
  useEffect(() => {
    if (!selectedTaskId) {
      setTaskDetail(null);
      return;
    }
    async function loadTaskDetail() {
      setLoadingDetail(true);
      try {
        const intel = await getTaskIntelligence(selectedTaskId!);
        setTaskDetail(intel);
      } catch (err) {
        console.error('Failed to load task intelligence:', err);
      } finally {
        setLoadingDetail(false);
      }
    }
    loadTaskDetail();
  }, [selectedTaskId]);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (selectedDept !== 'ALL' && t.department_code !== selectedDept) return false;
      if (selectedSection !== 'ALL' && t.section_id !== selectedSection && !t.section_name?.includes(selectedSection)) return false;
      if (selectedSeverity !== 'ALL' && t.severity !== selectedSeverity) return false;
      if (selectedStatus !== 'ALL' && t.status !== selectedStatus) return false;
      if (selectedPowerCut !== 'ALL') {
        const needsCut = selectedPowerCut === 'YES';
        if (Boolean(t.requires_power_isolation) !== needsCut) return false;
      }
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const codeMatch = t.task_code?.toLowerCase().includes(term);
        const typeMatch = t.maintenance_type?.toLowerCase().includes(term);
        const assetMatch = t.asset_name?.toLowerCase().includes(term);
        const secMatch = t.section_name?.toLowerCase().includes(term);
        if (!codeMatch && !typeMatch && !assetMatch && !secMatch) return false;
      }
      return true;
    });
  }, [tasks, selectedDept, selectedSection, selectedSeverity, selectedStatus, selectedPowerCut, searchTerm]);

  // Actions
  const handleDuplicate = async () => {
    if (!selectedTaskId) return;
    try {
      await duplicateTask(selectedTaskId);
      fetchTasks();
      setSelectedTaskId(null);
    } catch (err: any) {
      alert(err.message || 'Duplicate failed');
    }
  };

  const handleDefer = async () => {
    if (!selectedTaskId || !deferDate) return;
    try {
      await deferTask(selectedTaskId, deferReason, new Date(deferDate).toISOString());
      setDeferModalOpen(false);
      fetchTasks();
      setSelectedTaskId(null);
    } catch (err: any) {
      alert(err.message || 'Defer failed');
    }
  };

  const handleComplete = async () => {
    if (!selectedTaskId) return;
    try {
      await completeTask(selectedTaskId, completeNote, new Date().toISOString());
      setCompleteModalOpen(false);
      fetchTasks();
      setSelectedTaskId(null);
    } catch (err: any) {
      alert(err.message || 'Complete failed');
    }
  };

  const handleDelete = async () => {
    if (!selectedTaskId) return;
    try {
      await deleteTask(selectedTaskId);
      setDeleteConfirmOpen(false);
      fetchTasks();
      setSelectedTaskId(null);
    } catch (err: any) {
      alert(err.message || 'Delete failed');
    }
  };

  const handleExportCsv = () => {
    const headers = ['Work ID,Department,Section,Asset,Type,Severity,Detected,DueDate,Duration,PowerCut,Priority,Status,Source'];
    const rows = filteredTasks.map((t) =>
      [
        t.task_code,
        t.department_code || '',
        `"${t.section_name || ''}"`,
        `"${t.asset_name || ''}"`,
        `"${t.maintenance_type}"`,
        t.severity,
        t.detected_at || '',
        t.due_date || '',
        t.estimated_duration_min,
        t.requires_power_isolation ? 'Yes' : 'No',
        t.priority_score,
        t.status,
        t.source || 'Manual',
      ].join(',')
    );
    const blob = new Blob([[...headers, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SANGAM_Maintenance_Demand_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const handleImportCsv = async () => {
    if (!importCsvText.trim()) return;
    const lines = importCsvText.trim().split('\n');
    const parsedRows = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',');
      if (parts.length >= 4) {
        parsedRows.push({
          department: parts[0]?.trim() || 'ENG',
          section: parts[1]?.trim() || sections[0]?.id || '',
          maintenance_type: parts[2]?.trim() || 'Track Packing',
          severity: parts[3]?.trim() || 'Medium',
          duration_min: Number(parts[4]?.trim() || 90),
          due_date: new Date(Date.now() + 3 * 86400000).toISOString(),
          requires_power_isolation: parts[5]?.trim()?.toLowerCase() === 'yes',
        });
      }
    }
    try {
      const res = await importCsvTasks(parsedRows);
      setImportStatus(`Successfully imported ${res.imported_count} tasks.`);
      fetchTasks();
      setTimeout(() => {
        setImportModalOpen(false);
        setImportStatus(null);
        setImportCsvText('');
      }, 1500);
    } catch (err: any) {
      setImportStatus(`Import error: ${err.message}`);
    }
  };

  const activeTask = tasks.find((t) => t.id === selectedTaskId);

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-panel">
      <TopBar title="Maintenance Work Demand" subtitle="Unified Civil Engineering, TRD, and S&T Maintenance Register" />
      <WorkflowBar activeStage={1} />

      <main className="p-6 max-w-7xl mx-auto w-full space-y-5">
        {/* Page Guide Banner */}
        <PageGuideBanner
          pageTitle="Maintenance Work"
          purpose="Add maintenance requests from Engineering, TRD, and S&T here. SANGAM uses these tasks as the demand input for block planning. Make sure each task has section, duration, and resource requirements before generating a plan."
          inputs={['Department (ENG, TRD, S&T)', 'Corridor Section (e.g. Matunga–Sion)', 'Work Type & Severity', 'Estimated Duration & Minimum Contiguous Block', 'Power Isolation Need', 'Required Gang or Machine']}
          outputs={['Multi-criteria Priority Score (0–100)', 'Grouping & Joint Possession Eligibility', 'Corridor Work Demand Register']}
          nextStep={{ label: 'Check Resources or Proceed to Create Plan', to: '/planning/create' }}
        />

        {/* ── Top Actions Bar ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-lg border border-border shadow-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                setTaskToEdit(null);
                setIsEmergencyModal(false);
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-accent text-white font-bold text-xs hover:bg-accent-hover transition-colors shadow-xs cursor-pointer"
              title="Creates a new maintenance requirement that will be considered by future block plans."
            >
              <Plus className="w-4 h-4" />
              <span>Add Maintenance Work</span>
            </button>

            <button
              onClick={() => {
                setTaskToEdit(null);
                setIsEmergencyModal(true);
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded bg-red-600 text-white font-bold text-xs hover:bg-red-700 transition-colors shadow-xs cursor-pointer"
              title="Quick-add Critical Emergency Defect needing immediate corridor window"
            >
              <AlertOctagon className="w-4 h-4" />
              <span>Emergency Work</span>
            </button>

            <button
              onClick={() => setImportModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-border bg-white text-text-primary font-semibold text-xs hover:bg-panel cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-text-secondary" />
              <span>Import CSV</span>
            </button>

            <button
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-border bg-white text-text-primary font-semibold text-xs hover:bg-panel cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-text-secondary" />
              <span>Export CSV</span>
            </button>
          </div>

          <div className="text-xs font-mono text-text-secondary">
            Showing <strong className="text-text-primary font-bold">{filteredTasks.length}</strong> of{' '}
            {tasks.length} total tasks
          </div>
        </div>

        {/* ── Filters Bar ── */}
        <div className="bg-white p-4 rounded-lg border border-border shadow-xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-2.5">
            {/* Search */}
            <div className="md:col-span-2 relative">
              <Search className="w-4 h-4 text-text-secondary absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search task code, asset, or work..."
                className="w-full pl-9 pr-3 py-1.5 border border-border rounded text-xs bg-white focus:border-accent"
              />
            </div>

            {/* Department */}
            <div>
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="w-full p-1.5 border border-border rounded text-xs bg-white font-medium"
              >
                <option value="ALL">All Departments</option>
                <option value="ENG">Engineering (ENG)</option>
                <option value="TRD">Traction (TRD)</option>
                <option value="SNT">Signal & Telecom (S&T)</option>
              </select>
            </div>

            {/* Section */}
            <div>
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="w-full p-1.5 border border-border rounded text-xs bg-white font-medium"
              >
                <option value="ALL">All Sections</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Severity */}
            <div>
              <select
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value)}
                className="w-full p-1.5 border border-border rounded text-xs bg-white font-medium"
              >
                <option value="ALL">All Severities</option>
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>

            {/* Status */}
            <div>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full p-1.5 border border-border rounded text-xs bg-white font-medium"
              >
                <option value="ALL">All Statuses</option>
                <option value="Pending">Pending / Ready</option>
                <option value="New">New Draft</option>
                <option value="Scheduled">Scheduled in Block</option>
                <option value="Approved">Approved</option>
                <option value="Completed">Completed</option>
                <option value="Deferred">Deferred</option>
              </select>
            </div>

            {/* Power Cut */}
            <div>
              <select
                value={selectedPowerCut}
                onChange={(e) => setSelectedPowerCut(e.target.value)}
                className="w-full p-1.5 border border-border rounded text-xs bg-white font-medium"
              >
                <option value="ALL">Power Cut (Any)</option>
                <option value="YES">Power Cut Required</option>
                <option value="NO">No Power Isolation</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── Table Register ── */}
        <div className="bg-white rounded-lg border border-border shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-panel text-[11px] font-mono text-text-secondary uppercase tracking-wider">
                  <th className="p-3">Work ID</th>
                  <th className="p-3">Dept</th>
                  <th className="p-3">Section</th>
                  <th className="p-3">Asset</th>
                  <th className="p-3">Work Type</th>
                  <th className="p-3">Severity</th>
                  <th className="p-3">Due Date</th>
                  <th className="p-3">Duration</th>
                  <th className="p-3 text-center">Power Cut</th>
                  <th className="p-3 text-center">Priority</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredTasks.map((t) => {
                  const isSelected = t.id === selectedTaskId;
                  const isCrit = t.severity === 'Critical';

                  return (
                    <tr
                      key={t.id}
                      onClick={() => setSelectedTaskId(t.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-accent-tint/30 font-semibold border-l-4 border-l-accent'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="p-3 font-mono font-bold text-accent whitespace-nowrap">
                        <span>{t.task_code}</span>
                      </td>
                      <td className="p-3">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                          t.department_code === 'ENG'
                            ? 'bg-blue-100 text-blue-800'
                            : t.department_code === 'TRD'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}>
                          {t.department_code || 'ENG'}
                        </span>
                      </td>
                      <td className="p-3 text-text-primary whitespace-nowrap">
                        {t.section_name || 'Matunga–Sion'}
                      </td>
                      <td className="p-3 text-text-secondary truncate max-w-[120px]" title={t.asset_name || ''}>
                        {t.asset_name || 'Track Asset'}
                      </td>
                      <td className="p-3 font-medium text-text-primary max-w-xs truncate" title={t.maintenance_type}>
                        {t.maintenance_type}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isCrit
                            ? 'bg-red-100 text-red-700'
                            : t.severity === 'High'
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {t.severity}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-text-secondary whitespace-nowrap">
                        {t.due_date ? new Date(t.due_date).toLocaleDateString('en-GB') : '—'}
                      </td>
                      <td className="p-3 font-mono text-text-primary whitespace-nowrap">
                        {t.estimated_duration_min} min
                      </td>
                      <td className="p-3 text-center">
                        {t.requires_power_isolation ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 text-[10px] font-mono font-bold">
                            <Zap className="w-2.5 h-2.5" /> 25kV
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono text-2xs">—</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded font-mono font-black text-xs ${
                          (t.priority_score || 0) >= 80
                            ? 'bg-red-100 text-red-800'
                            : (t.priority_score || 0) >= 50
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {t.priority_score ? t.priority_score.toFixed(1) : '50.0'}
                        </span>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          t.status === 'Completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : t.status === 'Deferred'
                            ? 'bg-amber-100 text-amber-800'
                            : t.status === 'Scheduled'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="p-3 text-slate-500 text-[10px] font-mono whitespace-nowrap">
                        {t.source || 'Manual'}
                      </td>
                    </tr>
                  );
                })}

                {filteredTasks.length === 0 && (
                  <tr>
                    <td colSpan={12} className="p-8 text-center text-text-secondary">
                      {isLoading ? (
                        <span>Loading maintenance demand...</span>
                      ) : (
                        <div>
                          <p className="font-semibold text-text-primary">No maintenance work matches your criteria.</p>
                          <p className="text-2xs mt-1">Click "+ Add Maintenance Work" above to enter a requirement.</p>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* ── Task Detail Drawer (Right Slide-over) ── */}
      {selectedTaskId && activeTask && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col border-l border-border animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-4 border-b border-border flex items-center justify-between bg-panel">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-accent text-white font-mono font-bold text-xs">
                  {activeTask.task_code}
                </span>
                <h3 className="text-sm font-bold text-text-primary truncate max-w-sm">
                  {activeTask.maintenance_type}
                </h3>
              </div>
              <button
                onClick={() => setSelectedTaskId(null)}
                className="p-1 rounded hover:bg-slate-200 text-text-secondary hover:text-text-primary cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Primary Action Buttons on Drawer */}
            <div className="px-4 py-2.5 border-b border-border bg-white flex items-center gap-2 flex-wrap text-xs">
              <button
                onClick={() => {
                  setTaskToEdit(activeTask);
                  setIsModalOpen(true);
                }}
                className="px-2.5 py-1 rounded border border-border bg-white hover:bg-slate-50 font-bold text-text-primary cursor-pointer"
              >
                Edit
              </button>

              <button
                onClick={handleDuplicate}
                className="px-2.5 py-1 rounded border border-border bg-white hover:bg-slate-50 font-medium text-text-secondary cursor-pointer flex items-center gap-1"
              >
                <Copy className="w-3 h-3" /> Duplicate
              </button>

              <button
                onClick={() => {
                  setDeferDate(activeTask.due_date ? activeTask.due_date.slice(0, 10) : '');
                  setDeferModalOpen(true);
                }}
                className="px-2.5 py-1 rounded border border-amber-300 bg-amber-50 hover:bg-amber-100 font-bold text-amber-800 cursor-pointer"
              >
                Defer
              </button>

              <button
                onClick={() => setCompleteModalOpen(true)}
                className="px-2.5 py-1 rounded border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 font-bold text-emerald-800 cursor-pointer flex items-center gap-1"
              >
                <CheckCircle2 className="w-3 h-3" /> Mark Completed
              </button>

              <button
                onClick={() => setDeleteConfirmOpen(true)}
                className="px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50 font-medium ml-auto cursor-pointer flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" /> Delete
              </button>
            </div>

            {/* Drawer Tabs Navigation */}
            <div className="flex border-b border-border text-xs font-semibold px-4 bg-slate-50">
              <button
                onClick={() => setDrawerTab('details')}
                className={`py-2.5 px-3 border-b-2 transition-colors ${
                  drawerTab === 'details'
                    ? 'border-accent text-accent font-bold'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                1. Details
              </button>
              <button
                onClick={() => setDrawerTab('planning')}
                className={`py-2.5 px-3 border-b-2 transition-colors ${
                  drawerTab === 'planning'
                    ? 'border-accent text-accent font-bold'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                2. Planning
              </button>
              <button
                onClick={() => setDrawerTab('compatibility')}
                className={`py-2.5 px-3 border-b-2 transition-colors ${
                  drawerTab === 'compatibility'
                    ? 'border-accent text-accent font-bold'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                3. Compatibility
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-5 text-xs space-y-4">
              {loadingDetail && (
                <div className="p-2 bg-panel border border-border rounded text-center text-text-secondary text-2xs animate-pulse">
                  Loading task intelligence...
                </div>
              )}
              {/* TAB 1: DETAILS */}
              {drawerTab === 'details' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 bg-panel p-3 rounded-lg border border-border">
                    <div>
                      <span className="text-text-secondary text-[11px]">Department:</span>
                      <div className="font-bold text-text-primary mt-0.5">{activeTask.department_name || activeTask.department_code}</div>
                    </div>
                    <div>
                      <span className="text-text-secondary text-[11px]">Section:</span>
                      <div className="font-bold text-text-primary mt-0.5">{activeTask.section_name}</div>
                    </div>
                    <div>
                      <span className="text-text-secondary text-[11px]">Asset:</span>
                      <div className="font-bold text-text-primary mt-0.5">{activeTask.asset_name || 'Track Infrastructure'}</div>
                    </div>
                    <div>
                      <span className="text-text-secondary text-[11px]">Severity:</span>
                      <div className="font-bold text-text-primary mt-0.5">{activeTask.severity}</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-bold text-text-primary uppercase tracking-wider font-mono text-2xs mb-1">
                      Work Description
                    </h4>
                    <p className="text-text-secondary bg-panel p-3 rounded border border-border leading-relaxed">
                      {activeTask.description || 'No detailed narrative provided. Standard cyclic maintenance specifications apply.'}
                    </p>
                  </div>

                  <div>
                    <h4 className="font-bold text-text-primary uppercase tracking-wider font-mono text-2xs mb-1">
                      Operational & Safety Notes
                    </h4>
                    <p className="text-text-secondary bg-panel p-3 rounded border border-border leading-relaxed">
                      {activeTask.operational_notes || 'Ensure coordination with Section Controller. Look-out protection required.'}
                    </p>
                  </div>

                  {/* Railway Location & Track Block Details */}
                  <div className="p-3 bg-panel border border-border rounded grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-text-secondary">Track Line:</span>{' '}
                      <strong className="text-text-primary font-mono">{activeTask.track_line || 'UP Line'}</strong>
                    </div>
                    <div>
                      <span className="text-text-secondary">Chainage KM:</span>{' '}
                      <strong className="text-text-primary font-mono">
                        {activeTask.chainage_from_km != null ? `KM ${activeTask.chainage_from_km} – ${activeTask.chainage_to_km}` : 'Full Section'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-text-secondary">Block Type:</span>{' '}
                      <strong className="text-text-primary">{activeTask.block_type_required || 'Traffic Block'}</strong>
                    </div>
                    <div>
                      <span className="text-text-secondary">Signal Disconnection:</span>{' '}
                      <strong className="text-text-primary">{activeTask.requires_signal_disconnection ? 'Yes (S&T Required)' : 'No'}</strong>
                    </div>
                    <div>
                      <span className="text-text-secondary">Requires Power Cut:</span>{' '}
                      <strong className="text-text-primary">{activeTask.requires_power_isolation ? 'Yes (OHE 25kV)' : 'No'}</strong>
                    </div>
                    <div>
                      <span className="text-text-secondary">Can Run Parallel:</span>{' '}
                      <strong className="text-text-primary">{activeTask.can_run_parallel ? 'Yes' : 'No'}</strong>
                    </div>
                    <div>
                      <span className="text-text-secondary">Detected:</span>{' '}
                      <span className="font-mono text-text-primary">
                        {activeTask.detected_at ? new Date(activeTask.detected_at).toLocaleDateString('en-GB') : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-text-secondary">Target Due Date:</span>{' '}
                      <span className="font-mono text-text-primary font-bold">
                        {activeTask.due_date ? new Date(activeTask.due_date).toLocaleDateString('en-GB') : '—'}
                      </span>
                    </div>
                  </div>

                  {activeTask.status === 'Deferred' && (
                    <div className="p-3 rounded bg-amber-50 border border-amber-200 text-amber-800">
                      <strong>Deferred:</strong> {activeTask.deferred_reason}
                    </div>
                  )}

                  {activeTask.status === 'Completed' && (
                    <div className="p-3 rounded bg-emerald-50 border border-emerald-200 text-emerald-800">
                      <strong>Completed:</strong> {activeTask.completion_notes}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: PLANNING */}
              {drawerTab === 'planning' && (
                <div className="space-y-4">
                  {/* Priority Summary */}
                  <div className="bg-panel p-3.5 rounded-lg border border-border flex items-center justify-between">
                    <div>
                      <div className="text-[11px] text-text-secondary font-medium">Railway Priority Score</div>
                      <div className="flex items-baseline gap-2 mt-0.5">
                        <span className="text-3xl font-black text-accent font-mono">
                          {activeTask.priority_score ? activeTask.priority_score.toFixed(1) : '50.0'}
                        </span>
                        <span className="text-text-secondary text-xs font-mono">/ 100</span>
                        <span className={`px-2 py-0.5 rounded text-2xs font-bold uppercase tracking-wider ${
                          activeTask.severity === 'Critical' ? 'bg-red-100 text-red-800' :
                          activeTask.severity === 'High' ? 'bg-amber-100 text-amber-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {activeTask.severity}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => setShowPriorityExplainer(!showPriorityExplainer)}
                      className="px-3 py-1.5 rounded-lg border border-border bg-white font-semibold text-xs hover:bg-slate-50 flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <span>Why this priority?</span>
                      {showPriorityExplainer ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* Priority Explainer Drawer */}
                  {showPriorityExplainer && taskDetail?.priority_breakdown && (
                    <div className="p-3.5 rounded-lg border border-blue-200 bg-blue-50/50 space-y-3 text-xs">
                      <div className="flex items-center justify-between border-b border-blue-100 pb-2">
                        <span className="font-bold text-[#173F7A] text-2xs uppercase tracking-wider font-mono">
                          Explainable Multi-Factor Scoring
                        </span>
                        <span className="text-[10px] text-text-secondary font-mono">
                          Score = Σ contributions
                        </span>
                      </div>

                      {/* Plain-English Explanation */}
                      {taskDetail.priority_breakdown.explanation_text && (
                        <div className="p-2.5 rounded bg-white border border-blue-200 text-xs text-text-primary italic leading-relaxed">
                          "{taskDetail.priority_breakdown.explanation_text}"
                        </div>
                      )}

                      {/* Component breakdown bars */}
                      <div className="space-y-2 pt-1">
                        {Object.entries(taskDetail.priority_breakdown.components).map(([factor, item]: any) => {
                          const maxWeight = (item.weight || 0.2) * 100;
                          const pct = Math.min(100, Math.max(0, (item.contribution / maxWeight) * 100));
                          return (
                            <div key={factor} className="space-y-1">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-medium text-text-primary capitalize">{item.label || factor.replace(/_/g, ' ')}</span>
                                <span className="font-mono font-bold text-[#173F7A]">
                                  +{item.contribution.toFixed(1)} pts
                                </span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-[#173F7A] rounded-full transition-all"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <div className="text-[10px] text-text-secondary">
                                {item.detail} (Weight: {(item.weight * 100).toFixed(0)}%)
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Duration requirements */}
                  <div className="p-3 rounded bg-panel border border-border grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-text-secondary">Estimated Duration:</span>
                      <div className="font-mono font-bold text-text-primary text-sm mt-0.5">
                        {activeTask.estimated_duration_min} minutes
                      </div>
                    </div>
                    <div>
                      <span className="text-text-secondary">Min Continuous Window:</span>
                      <div className="font-mono font-bold text-text-primary text-sm mt-0.5">
                        {activeTask.minimum_contiguous_block_min} minutes
                      </div>
                    </div>
                  </div>

                  {/* Scheduled Block Assignment (if any) */}
                  <div>
                    <h4 className="font-bold text-text-primary uppercase tracking-wider font-mono text-2xs mb-1">
                      Active Block Assignment
                    </h4>
                    {taskDetail?.scheduled_assignment ? (
                      <div className="p-3 rounded bg-emerald-50 border border-emerald-200 space-y-1">
                        <div className="font-bold text-emerald-900">
                          Assigned to Block {taskDetail.scheduled_assignment.block_id.slice(0, 8)}
                        </div>
                        <div className="text-[11px] text-emerald-800 font-mono">
                          {new Date(taskDetail.scheduled_assignment.block_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
                          {new Date(taskDetail.scheduled_assignment.block_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({taskDetail.scheduled_assignment.duration_min} min)
                        </div>
                        {taskDetail.scheduled_assignment.is_joint_block && (
                          <div className="text-[10px] font-semibold text-emerald-700 mt-1">
                            ✓ Co-scheduled in Joint Multi-Department Possession
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-3 rounded bg-panel border border-border text-text-secondary">
                        Not yet assigned to an active block plan. Run "Create Block Plan" to allocate.
                      </div>
                    )}
                  </div>

                  {/* Suitable Windows */}
                  <div>
                    <h4 className="font-bold text-text-primary uppercase tracking-wider font-mono text-2xs mb-1">
                      Suitable Candidate Windows ({taskDetail?.candidate_windows.length || 0})
                    </h4>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {taskDetail?.candidate_windows.slice(0, 4).map((cw) => (
                        <div key={cw.id} className="p-2 rounded border border-border bg-panel flex items-center justify-between">
                          <div>
                            <span className="font-mono font-bold text-text-primary">
                              {new Date(cw.window_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
                              {new Date(cw.window_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="text-text-secondary text-[10px] ml-2 font-mono">({cw.duration_min} min)</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            cw.risk_level === 'Low'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {cw.risk_level} Risk
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: COMPATIBILITY */}
              {drawerTab === 'compatibility' && (
                <div className="space-y-4">
                  <div className="bg-panel p-3 rounded border border-border text-text-secondary text-[11px] leading-relaxed">
                    Can this maintenance request share a corridor block possession with other departments on Section{' '}
                    <strong>{activeTask.section_name}</strong>?
                  </div>

                  {/* Compatible Work */}
                  <div>
                    <h4 className="font-bold text-emerald-700 uppercase tracking-wider font-mono text-2xs mb-1.5 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Compatible Work ({taskDetail?.relationships.compatible_count || 0})
                    </h4>
                    <div className="space-y-1.5">
                      {taskDetail?.relationships.compatible.map((cw) => (
                        <div key={cw.task_id} className="p-2.5 rounded border border-emerald-200 bg-emerald-50/50 flex items-center justify-between">
                          <div>
                            <div className="font-bold text-text-primary flex items-center gap-1.5">
                              <span className="px-1.5 py-0.2 rounded bg-white text-[10px] font-mono border border-emerald-300">{cw.department}</span>
                              <span>{cw.task_code}</span>
                            </div>
                            <div className="text-[11px] text-text-secondary mt-0.5 truncate max-w-xs">{cw.type}</div>
                          </div>
                          <span className="text-[10px] font-mono text-emerald-800 font-bold">Parallel OK</span>
                        </div>
                      ))}
                      {taskDetail?.relationships.compatible.length === 0 && (
                        <div className="text-slate-500 py-2 text-center">No concurrent compatible tasks on this section.</div>
                      )}
                    </div>
                  </div>

                  {/* Conflicting Work */}
                  <div>
                    <h4 className="font-bold text-red-700 uppercase tracking-wider font-mono text-2xs mb-1.5 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Conflicting Work ({taskDetail?.relationships.conflict_count || 0})
                    </h4>
                    <div className="space-y-1.5">
                      {taskDetail?.relationships.conflict.map((cf) => (
                        <div key={cf.task_id} className="p-2.5 rounded border border-red-200 bg-red-50/50 flex items-center justify-between">
                          <div>
                            <div className="font-bold text-text-primary flex items-center gap-1.5">
                              <span className="px-1.5 py-0.2 rounded bg-white text-[10px] font-mono border border-red-300">{cf.department}</span>
                              <span>{cf.task_code}</span>
                            </div>
                            <div className="text-[11px] text-text-secondary mt-0.5">{cf.type}</div>
                          </div>
                          <span className="text-[10px] font-mono text-red-700 font-bold">Safety Exclusion</span>
                        </div>
                      ))}
                      {taskDetail?.relationships.conflict.length === 0 && (
                        <div className="text-slate-500 py-2 text-center">No safety conflicts with other tasks.</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-border bg-panel flex justify-end">
              <button
                onClick={() => setSelectedTaskId(null)}
                className="px-4 py-2 rounded border border-border bg-white text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add / Edit Maintenance Modal ── */}
      <MaintenanceModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setTaskToEdit(null);
        }}
        onSuccess={() => {
          fetchTasks();
          setSelectedTaskId(null);
        }}
        taskToEdit={taskToEdit}
        sections={sections}
        isEmergency={isEmergencyModal}
      />

      {/* ── Defer Task Modal ── */}
      {deferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg border border-border p-5 max-w-md w-full space-y-4 shadow-xl text-xs">
            <h3 className="text-sm font-bold text-text-primary">Defer Maintenance Request</h3>
            <p className="text-text-secondary">
              Provide an operational justification and specify a new due date for this work.
            </p>

            <div>
              <label className="block font-bold text-text-primary mb-1">Reason for Deferral *</label>
              <select
                value={deferReason}
                onChange={(e) => setDeferReason(e.target.value)}
                className="w-full p-2 border border-border rounded bg-white"
              >
                <option value="Track Machine Deployment Delayed">Track Machine Deployment Delayed</option>
                <option value="Tower Wagon Diverted for Emergency">Tower Wagon Diverted for Emergency</option>
                <option value="Weather / Monsoon Restriction">Weather / Monsoon Restriction</option>
                <option value="VIP Train Traffic Movement">VIP Train Traffic Movement</option>
                <option value="Section Engineer Decision">Section Engineer Operational Decision</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-text-primary mb-1">New Target Date *</label>
              <input
                type="date"
                value={deferDate}
                onChange={(e) => setDeferDate(e.target.value)}
                className="w-full p-2 border border-border rounded bg-white font-mono"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeferModalOpen(false)}
                className="px-3 py-1.5 rounded border border-border bg-white text-text-secondary font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleDefer}
                className="px-4 py-1.5 rounded bg-amber-600 text-white font-bold hover:bg-amber-700"
              >
                Save Deferral
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Complete Task Modal ── */}
      {completeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg border border-border p-5 max-w-md w-full space-y-4 shadow-xl text-xs">
            <h3 className="text-sm font-bold text-text-primary">Mark Task Completed</h3>
            <p className="text-text-secondary">
              Certify that this maintenance work has been completed and track fit for normal train speed.
            </p>

            <div>
              <label className="block font-bold text-text-primary mb-1">Certification Note</label>
              <input
                type="text"
                value={completeNote}
                onChange={(e) => setCompleteNote(e.target.value)}
                className="w-full p-2 border border-border rounded bg-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setCompleteModalOpen(false)}
                className="px-3 py-1.5 rounded border border-border bg-white text-text-secondary font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleComplete}
                className="px-4 py-1.5 rounded bg-emerald-600 text-white font-bold hover:bg-emerald-700"
              >
                Certify & Complete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg border border-border p-5 max-w-sm w-full space-y-3 shadow-xl text-xs">
            <h3 className="text-sm font-bold text-red-600 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" /> Confirm Deletion
            </h3>
            <p className="text-text-secondary">
              Are you sure you want to permanently delete this maintenance request? This action cannot be undone.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmOpen(false)}
                className="px-3 py-1.5 rounded border border-border bg-white text-text-secondary font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-1.5 rounded bg-red-600 text-white font-bold hover:bg-red-700"
              >
                Yes, Delete Task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Import CSV Modal ── */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg border border-border p-5 max-w-lg w-full space-y-4 shadow-xl text-xs">
            <h3 className="text-sm font-bold text-text-primary">Import Maintenance CSV</h3>
            <p className="text-text-secondary">
              Paste CSV text formatted as: <code>Department,Section,WorkType,Severity,DurationMin,PowerCut</code>
            </p>

            <textarea
              rows={6}
              value={importCsvText}
              onChange={(e) => setImportCsvText(e.target.value)}
              placeholder="ENG,Matunga–Sion,Deep Ballast Tamping,High,90,No&#10;TRD,Matunga–Sion,Catenary Sag Adjustment,Medium,60,Yes&#10;SNT,Matunga–Sion,Track Circuit Testing,Low,45,No"
              className="w-full p-2 border border-border rounded font-mono text-xs bg-panel"
            />

            {importStatus && (
              <div className="p-2 rounded bg-slate-100 text-text-primary font-mono text-2xs">
                {importStatus}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setImportModalOpen(false)}
                className="px-3 py-1.5 rounded border border-border bg-white text-text-secondary font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleImportCsv}
                className="px-4 py-1.5 rounded bg-accent text-white font-bold hover:bg-accent-hover"
              >
                Import Tasks
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
