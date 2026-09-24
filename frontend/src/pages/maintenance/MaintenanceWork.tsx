import { useEffect, useState, useMemo } from 'react';
import TopBar from '../../components/TopBar';
import WorkflowBar from '../../components/WorkflowBar';
import MaintenanceModal from '../../components/maintenance/MaintenanceModal';
import { usePlanning } from '../../context/PlanningContext';
import {
  getTasks,
  deleteTask,
  completeTask,
  type MaintenanceTask,
} from '../../lib/apiClient';
import {
  Plus,
  Search,
  CheckCircle2,
  Trash2,
  Edit2,
  X,
  Zap,
  Radio,
  Layers,
} from 'lucide-react';

export default function MaintenanceWork() {
  const { sections, setWorkflowStage } = usePlanning();

  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 3 Essential Filters as per requirement
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedSection, setSelectedSection] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals & Drawers
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<MaintenanceTask | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

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

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const dept = t.department_code || t.department || t.department_id || 'ENG';
      if (selectedDept !== 'ALL' && dept !== selectedDept) return false;
      if (selectedSection !== 'ALL' && t.section_name !== selectedSection && t.section_id !== selectedSection) return false;
      if (selectedStatus !== 'ALL' && t.status !== selectedStatus) return false;

      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const code = (t.task_code || '').toLowerCase();
        const desc = (t.description || '').toLowerCase();
        const type = (t.maintenance_type || '').toLowerCase();
        const loc = (t.location_display || '').toLowerCase();
        if (!code.includes(query) && !desc.includes(query) && !type.includes(query) && !loc.includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [tasks, selectedDept, selectedSection, selectedStatus, searchTerm]);

  const activeTask = useMemo(() => {
    return tasks.find((t) => t.id === selectedTaskId) || null;
  }, [tasks, selectedTaskId]);

  const handleMarkComplete = async (taskId: string) => {
    try {
      await completeTask(taskId, 'Completed during sanctioned block', new Date().toISOString());
      await fetchTasks();
      setSelectedTaskId(null);
    } catch (err: any) {
      alert(err.message || 'Failed to complete task');
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this maintenance task?')) return;
    try {
      await deleteTask(taskId);
      await fetchTasks();
      setSelectedTaskId(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete task');
    }
  };

  const getProtectionLabel = (t: MaintenanceTask) => {
    if (t.requires_power_isolation) return 'Power Block';
    if ((t as any).requires_signal_disconnection) return 'S&T Disconnection';
    return 'Traffic Block';
  };

  const getProtectionBadge = (t: MaintenanceTask) => {
    const label = getProtectionLabel(t);
    if (label === 'Power Block') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
          <Zap className="w-3 h-3 text-amber-600" />
          Power Block
        </span>
      );
    }
    if (label === 'S&T Disconnection') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-purple-50 text-purple-800 border border-purple-200">
          <Radio className="w-3 h-3 text-purple-600" />
          S&T Disconnection
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">
        <Layers className="w-3 h-3 text-blue-600" />
        Traffic Block
      </span>
    );
  };

  const getDeptBadge = (deptCode: string) => {
    switch (deptCode) {
      case 'ENG':
        return <span className="px-2 py-0.5 text-xs font-bold rounded bg-blue-100 text-blue-800">ENG</span>;
      case 'SNT':
        return <span className="px-2 py-0.5 text-xs font-bold rounded bg-purple-100 text-purple-800">S&amp;T</span>;
      case 'TRD':
        return <span className="px-2 py-0.5 text-xs font-bold rounded bg-amber-100 text-amber-800">TRD</span>;
      default:
        return <span className="px-2 py-0.5 text-xs font-bold rounded bg-slate-100 text-slate-700">{deptCode}</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === 'Scheduled') {
      return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">Scheduled</span>;
    }
    if (status === 'Completed') {
      return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">Completed</span>;
    }
    return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-800">Ready for Planning</span>;
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-slate-50">
      <TopBar title="Maintenance Work" subtitle="Maintenance jobs waiting to be included in a block plan." />
      <WorkflowBar activeStage={1} />

      <main className="p-6 max-w-7xl mx-auto w-full space-y-5">
        {/* Header & Primary Action */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Maintenance Work</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Maintenance jobs waiting to be included in a block plan.
            </p>
          </div>
          <button
            onClick={() => {
              setTaskToEdit(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#173F7A] hover:bg-[#123262] text-white text-sm font-semibold rounded-lg shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            + Add Maintenance Work
          </button>
        </div>

        {/* 3 Essential Filters + Search */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* Department Filter */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
              Department
            </label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full text-xs font-medium border border-slate-300 rounded-md py-1.5 px-2.5 bg-white text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-[#173F7A]"
            >
              <option value="ALL">All Departments</option>
              <option value="ENG">Civil Engineering (ENG)</option>
              <option value="SNT">Signalling &amp; Telecom (S&amp;T)</option>
              <option value="TRD">Traction Distribution (TRD)</option>
            </select>
          </div>

          {/* Section Filter */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
              Section
            </label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="w-full text-xs font-medium border border-slate-300 rounded-md py-1.5 px-2.5 bg-white text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-[#173F7A]"
            >
              <option value="ALL">All Corridor Sections</option>
              {sections.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
              Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full text-xs font-medium border border-slate-300 rounded-md py-1.5 px-2.5 bg-white text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-[#173F7A]"
            >
              <option value="ALL">All Statuses</option>
              <option value="Ready for Planning">Ready for Planning</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Completed">Completed</option>
            </select>
          </div>

          {/* Search */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
              Search
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search task code, work..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs font-medium border border-slate-300 rounded-md py-1.5 pl-8 pr-2.5 bg-white text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-[#173F7A]"
              />
            </div>
          </div>
        </div>

        {/* Maintenance Tasks Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/75 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Task</th>
                  <th className="py-3 px-3">Department</th>
                  <th className="py-3 px-3">Section</th>
                  <th className="py-3 px-2">Line</th>
                  <th className="py-3 px-3">Location</th>
                  <th className="py-3 px-4">Work</th>
                  <th className="py-3 px-3">Duration</th>
                  <th className="py-3 px-3">Protection</th>
                  <th className="py-3 px-3 text-center">Priority</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-500 font-medium">
                      Loading maintenance register...
                    </td>
                  </tr>
                ) : filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-500 font-medium">
                      No maintenance tasks match the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((t) => {
                    const deptCode = t.department_code || t.department || t.department_id || 'ENG';
                    const isSelected = t.id === selectedTaskId;
                    const line = (t as any).track_line || 'UP';

                    return (
                      <tr
                        key={t.id}
                        onClick={() => setSelectedTaskId(isSelected ? null : t.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-blue-50/70 hover:bg-blue-50' : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="py-3 px-4 font-mono font-bold text-[#173F7A]">
                          {t.task_code}
                        </td>
                        <td className="py-3 px-3">
                          {getDeptBadge(deptCode)}
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-800">
                          {t.section_name || 'Corridor Section'}
                        </td>
                        <td className="py-3 px-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            line === 'UP' ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {line}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-600 font-mono text-[11px]">
                          {(t as any).location_display || `KM ${(t as any).chainage_from_km ?? 0.0}–${(t as any).chainage_to_km ?? 1.0}`}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-900">
                          {t.maintenance_type}
                        </td>
                        <td className="py-3 px-3 text-slate-700 whitespace-nowrap">
                          {t.estimated_duration_min} min
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {getProtectionBadge(t)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="font-mono font-bold text-slate-700 text-xs">
                            {t.priority_score ? Math.round(t.priority_score) : '—'}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {getStatusBadge(t.status)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
            <span>Showing {filteredTasks.length} of {tasks.length} tasks</span>
            <span>Click any task row to inspect full railway details</span>
          </div>
        </div>

        {/* Task Details Drawer (Modal / Panel) */}
        {activeTask && (
          <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white border-l border-slate-200 shadow-2xl z-50 flex flex-col">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <span className="text-xs font-mono font-bold text-[#173F7A]">{activeTask.task_code}</span>
                <h3 className="text-base font-bold text-slate-900">{activeTask.maintenance_type}</h3>
              </div>
              <button
                onClick={() => setSelectedTaskId(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 p-5 overflow-y-auto space-y-5 text-xs text-slate-700">
              {/* Overview Card */}
              <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Department</span>
                  <span>{getDeptBadge(activeTask.department_code || 'ENG')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Corridor Section</span>
                  <span className="font-bold text-slate-800">{activeTask.section_name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Line Direction</span>
                  <span className="font-bold text-slate-800">{(activeTask as any).track_line || 'UP Line'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Location Chainage</span>
                  <span className="font-mono text-slate-800">{(activeTask as any).location_display || 'KM 0.0 → 1.0'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Estimated Duration</span>
                  <span className="font-bold text-slate-800">{activeTask.estimated_duration_min} minutes</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Required Protection</span>
                  <span>{getProtectionBadge(activeTask)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Current Status</span>
                  <span>{getStatusBadge(activeTask.status)}</span>
                </div>
              </div>

              {/* Description */}
              <div>
                <h4 className="font-bold text-slate-800 mb-1">Work Description</h4>
                <p className="p-3 bg-slate-50 rounded border border-slate-200 text-slate-600 leading-relaxed">
                  {activeTask.description || 'Routine maintenance activity scheduled along this track section.'}
                </p>
              </div>

              {/* Priority & Urgency */}
              <div className="p-3.5 bg-blue-50/60 rounded-lg border border-blue-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-blue-900">Priority Score</span>
                  <span className="font-mono font-bold text-blue-900 text-sm">
                    {activeTask.priority_score ? Math.round(activeTask.priority_score) : '—'} / 100
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Severity Level</span>
                  <span className={`font-bold ${activeTask.severity === 'Critical' ? 'text-red-700' : 'text-slate-800'}`}>
                    {activeTask.severity}
                  </span>
                </div>
              </div>

              {/* Action Buttons (All Functional) */}
              <div className="space-y-2 pt-2">
                <button
                  onClick={() => {
                    setTaskToEdit(activeTask);
                    setIsModalOpen(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 border border-slate-300 rounded-lg text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit Task Details
                </button>

                {activeTask.status !== 'Completed' && (
                  <button
                    onClick={() => handleMarkComplete(activeTask.id)}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-xs transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Mark Work Completed
                  </button>
                )}

                <button
                  onClick={() => handleDelete(activeTask.id)}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg font-semibold transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Task
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add/Edit Modal */}
        <MaintenanceModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => {
            fetchTasks();
            setIsModalOpen(false);
          }}
          taskToEdit={taskToEdit}
          sections={sections.map((s) => ({ id: s.id, name: s.name }))}
        />
      </main>
    </div>
  );
}
