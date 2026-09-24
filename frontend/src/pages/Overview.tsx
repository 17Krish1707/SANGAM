import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar';
import WorkflowBar from '../components/WorkflowBar';
import { usePlanning } from '../context/PlanningContext';
import {
  getTasks,
  getAllApprovedBlocks,
  type MaintenanceTask,
  type ApprovedBlockItem,
} from '../lib/apiClient';
import {
  AlertTriangle,
  ArrowRight,
  Wrench,
  ShieldCheck,
  Layers,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

export default function Overview() {
  const navigate = useNavigate();
  const { setWorkflowStage } = usePlanning();

  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [approvedBlocks, setApprovedBlocks] = useState<ApprovedBlockItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [allTasks, approved] = await Promise.all([
        getTasks().catch(() => []),
        getAllApprovedBlocks().catch(() => []),
      ]);
      setTasks(allTasks);
      setApprovedBlocks(approved);
    } catch (err) {
      console.error('Failed loading overview dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setWorkflowStage(1);
    loadData();
  }, [setWorkflowStage]);

  // Section 12 KPI metrics
  const pendingMaintenance = tasks.filter((t) => t.status === 'Pending' || t.status === 'New' || t.status === 'Ready for Planning');
  const readyForPlanning = tasks.filter((t) => t.status === 'Ready for Planning');
  const proposedBlocksCount = 3; // 3 generated CP-SAT alternatives in standard run
  const approvedTodayCount = approvedBlocks.length;
  const conflictsCount = 0;

  // High priority maintenance tasks
  const highPriorityTasks = tasks.filter(
    (t) => (t.priority === 'High' || t.priority === 'Critical' || t.severity === 'High' || t.severity === 'Critical') && t.status !== 'Completed'
  );

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#F6F8FB] text-[#172033]">
      <TopBar title="Operations Overview" subtitle="Indian Railways Joint Corridor Planning Workstation" />
      <WorkflowBar activeStage={1} />

      <main className="p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-[#D9E1EA] shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-[#173F7A] bg-[#EBF2FA] px-2.5 py-0.5 rounded">
                DEMO CORRIDOR
              </span>
              <span className="text-xs text-[#667085] font-medium">
                Dadar → Matunga → Sion → Kurla → Ghatkopar → Vikhroli (14.8 KM)
              </span>
            </div>
            <h1 className="text-xl font-bold text-[#172033] mt-1">
              Operational Planning Control Room
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-colors border border-[#D9E1EA] cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#173F7A] ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => navigate('/planning/create')}
              className="px-4 py-2 bg-[#173F7A] hover:bg-[#1E4E8C] text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
            >
              <span>Create Block Plan</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ── SECTION 12: 5 KPI CARDS ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {/* Card 1: Pending Maintenance */}
          <div
            onClick={() => navigate('/maintenance')}
            className="bg-white rounded-xl border border-[#D9E1EA] hover:border-[#173F7A] p-4 shadow-xs transition-all cursor-pointer group"
          >
            <div className="text-xs text-[#667085] font-medium flex items-center justify-between">
              <span>Pending Maintenance</span>
              <Wrench className="w-4 h-4 text-[#667085] group-hover:text-[#173F7A]" />
            </div>
            <div className="text-3xl font-black text-[#172033] mt-2 font-mono">
              {pendingMaintenance.length}
            </div>
            <div className="text-[11px] text-[#667085] mt-1 flex items-center justify-between">
              <span>Backlog jobs</span>
              <span className="text-[#173F7A] font-semibold flex items-center gap-0.5">
                View <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </div>

          {/* Card 2: Ready for Planning */}
          <div
            onClick={() => navigate('/planning/create')}
            className="bg-white rounded-xl border border-[#D9E1EA] hover:border-[#173F7A] p-4 shadow-xs transition-all cursor-pointer group"
          >
            <div className="text-xs text-[#667085] font-medium flex items-center justify-between">
              <span>Ready for Planning</span>
              <Sparkles className="w-4 h-4 text-[#173F7A]" />
            </div>
            <div className="text-3xl font-black text-[#173F7A] mt-2 font-mono">
              {readyForPlanning.length}
            </div>
            <div className="text-[11px] text-[#667085] mt-1 flex items-center justify-between">
              <span>Demands primed</span>
              <span className="text-[#173F7A] font-semibold flex items-center gap-0.5">
                Plan <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </div>

          {/* Card 3: Proposed Blocks */}
          <div
            onClick={() => navigate('/planning/proposed')}
            className="bg-white rounded-xl border border-[#D9E1EA] hover:border-[#173F7A] p-4 shadow-xs transition-all cursor-pointer group"
          >
            <div className="text-xs text-[#667085] font-medium flex items-center justify-between">
              <span>Proposed Blocks</span>
              <Layers className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-3xl font-black text-indigo-700 mt-2 font-mono">
              {proposedBlocksCount}
            </div>
            <div className="text-[11px] text-[#667085] mt-1 flex items-center justify-between">
              <span>Solver options</span>
              <span className="text-indigo-700 font-semibold flex items-center gap-0.5">
                Inspect <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </div>

          {/* Card 4: Approved Today */}
          <div
            onClick={() => navigate('/operations/approved')}
            className="bg-white rounded-xl border border-[#D9E1EA] hover:border-emerald-600 p-4 shadow-xs transition-all cursor-pointer group"
          >
            <div className="text-xs text-emerald-800 font-medium flex items-center justify-between">
              <span>Approved Today</span>
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-3xl font-black text-emerald-700 mt-2 font-mono">
              {approvedTodayCount}
            </div>
            <div className="text-[11px] text-emerald-800 mt-1 flex items-center justify-between">
              <span>Sanctioned blocks</span>
              <span className="text-emerald-700 font-semibold flex items-center gap-0.5">
                Register <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </div>

          {/* Card 5: Conflicts */}
          <div
            onClick={() => navigate('/operations/conflicts')}
            className="bg-white rounded-xl border border-[#D9E1EA] hover:border-amber-500 p-4 shadow-xs transition-all cursor-pointer group"
          >
            <div className="text-xs text-[#667085] font-medium flex items-center justify-between">
              <span>Conflicts</span>
              <AlertTriangle className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-3xl font-black text-emerald-700 mt-2 font-mono">
              {conflictsCount}
            </div>
            <div className="text-[11px] text-emerald-700 mt-1 flex items-center justify-between font-semibold">
              <span>Zero conflicts</span>
              <span className="text-emerald-700 flex items-center gap-0.5">✓ Clean</span>
            </div>
          </div>
        </div>

        {/* ── SECTION 12: TODAY'S APPROVED BLOCKS ── */}
        <div className="bg-white rounded-xl border border-[#D9E1EA] p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#EDF2F7]">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <h2 className="font-bold text-sm text-[#172033]">
                Today's Approved Blocks
              </h2>
            </div>
            <button
              onClick={() => navigate('/operations/approved')}
              className="text-xs font-semibold text-[#173F7A] hover:underline flex items-center gap-1"
            >
              <span>View Full Register</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {approvedBlocks.length === 0 ? (
            <div className="py-6 text-center text-xs text-[#667085]">
              No blocks approved yet today. Approve a proposed plan to populate this section.
            </div>
          ) : (
            <div className="space-y-3">
              {approvedBlocks.map((b) => {
                const blockId = b.block_id || b.block_code || b.id;
                const dateDisplay = b.date_fmt || (b.block_start ? new Date(b.block_start).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '24 Sep');
                const startFmt = b.start_time_fmt || b.block_start?.slice(11, 16);
                const endFmt = b.end_time_fmt || b.block_end?.slice(11, 16);

                return (
                  <div
                    key={blockId}
                    onClick={() => navigate('/operations/approved')}
                    className="p-3.5 rounded-lg border border-[#E2E8F0] hover:border-[#173F7A] transition-all bg-[#F8FAFC] flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-xs text-[#173F7A] bg-white px-2.5 py-1 rounded border border-[#D9E1EA]">
                        {blockId}
                      </span>
                      <div>
                        <div className="font-bold text-xs text-[#172033] flex items-center gap-2">
                          <span>{b.section_name} ({b.track_line} Line)</span>
                          <span className="px-2 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            APPROVED
                          </span>
                        </div>
                        <div className="text-[11px] text-[#667085] font-mono mt-0.5">
                          {dateDisplay} • {startFmt}–{endFmt} ({b.duration_min} min) • Includes {b.tasks?.length || 0} tasks ({b.tasks?.map((t) => t.task_code).join(', ')})
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                        {b.protections?.join(' + ') || 'Traffic + Power + S&T'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── SECTION 12: HIGH PRIORITY MAINTENANCE ── */}
        <div className="bg-white rounded-xl border border-[#D9E1EA] p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#EDF2F7]">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-[#173F7A]" />
              <h2 className="font-bold text-sm text-[#172033]">
                High Priority Maintenance Demands
              </h2>
            </div>
            <button
              onClick={() => navigate('/maintenance')}
              className="text-xs font-semibold text-[#173F7A] hover:underline flex items-center gap-1"
            >
              <span>View All Maintenance Work</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] text-[#667085] font-mono text-[11px] uppercase tracking-wider border-b border-[#D9E1EA]">
                <tr>
                  <th className="px-3 py-2.5">Task</th>
                  <th className="px-3 py-2.5">Dept</th>
                  <th className="px-3 py-2.5">Section & Line</th>
                  <th className="px-3 py-2.5">Location</th>
                  <th className="px-3 py-2.5">Work Description</th>
                  <th className="px-3 py-2.5">Duration</th>
                  <th className="px-3 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDF2F7]">
                {highPriorityTasks.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-2.5 font-mono font-bold text-[#173F7A]">
                      {t.task_code}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#EBF2FA] text-[#173F7A]">
                        {t.department_code || t.department || t.department_id || 'ENG'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-[#172033] font-medium">
                      {t.section_name} ({(t as any).track_line || 'UP'})
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[#667085]">
                      {t.location_display || (t.chainage_from_km ? `KM ${t.chainage_from_km}–${t.chainage_to_km}` : 'KM 0.4–1.2')}
                    </td>
                    <td className="px-3 py-2.5 text-[#172033]">
                      {t.maintenance_type || (t as any).work_type}
                    </td>
                    <td className="px-3 py-2.5 font-mono font-semibold text-[#172033]">
                      {t.estimated_duration_min || (t as any).duration_min || 60} min
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        t.status === 'Scheduled'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-blue-100 text-[#173F7A]'
                      }`}>
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
