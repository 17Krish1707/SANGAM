import React, { useState, useEffect } from 'react';
import {
  getCorridorCompatibilityMatrix,
  type CompatibilityMatrixResponse,
  type Section,
} from '../../lib/apiClient';
import {
  Network,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Filter,
} from 'lucide-react';

interface Props {
  sections?: Section[];
  selectedSectionId?: string | null;
  onSelectTask?: (taskId: string) => void;
}

export const DepartmentCompatibilityMatrix: React.FC<Props> = ({
  sections = [],
  selectedSectionId = null,
  onSelectTask,
}) => {
  const [data, setData] = useState<CompatibilityMatrixResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterSection, setFilterSection] = useState<string>(selectedSectionId || 'ALL');
  const [relationshipFilter, setRelationshipFilter] = useState<'all' | 'compatible' | 'conflict'>('all');
  const [activeTab, setActiveTab] = useState<'network' | 'matrix' | 'bundles'>('network');

  useEffect(() => {
    loadMatrix();
  }, [filterSection]);

  const loadMatrix = async () => {
    setLoading(true);
    try {
      const secId = filterSection !== 'ALL' ? filterSection : undefined;
      const res = await getCorridorCompatibilityMatrix(secId);
      setData(res);
    } catch (err) {
      console.error('Failed to load compatibility matrix:', err);
    } finally {
      setLoading(false);
    }
  };

  const getDeptColor = (dept: string) => {
    switch (dept) {
      case 'ENG':
        return { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-300', dot: 'bg-blue-500', label: 'Civil Engineering (Track/P-Way)' };
      case 'TRD':
        return { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-300', dot: 'bg-amber-500', label: 'Traction Distribution (25kV OHE)' };
      case 'SNT':
      case 'SIG':
        return { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-300', dot: 'bg-emerald-500', label: 'Signal & Telecom' };
      default:
        return { bg: 'bg-slate-50', text: 'text-slate-800', border: 'border-slate-300', dot: 'bg-slate-500', label: 'General' };
    }
  };

  const filteredEdges = (data?.edges || []).filter((e) => {
    if (relationshipFilter === 'all') return true;
    return e.relationship === relationshipFilter;
  });

  return (
    <div className="bg-white rounded-xl border border-[#D9E1EA] shadow-xs overflow-hidden text-xs">
      {/* Header Bar */}
      <div className="p-5 border-b border-[#D9E1EA] bg-[#F8FAFC] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Network className="w-5 h-5 text-[#173F7A]" />
            <h3 className="text-sm font-bold text-[#172033]">
              Department Compatibility & Joint Work Graph
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-[#173F7A] font-mono text-[10px] font-bold">
              NetworkX Rule Engine
            </span>
          </div>
          <p className="text-[11px] text-[#667085] mt-1">
            Data-driven inter-department safety analysis evaluating which Civil (ENG), OHE (TRD), and Signalling (S&T) work orders can be safely co-located in a single joint block.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Section Filter */}
          {sections.length > 0 && (
            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-[#D9E1EA]">
              <Filter className="w-3.5 h-3.5 text-[#667085]" />
              <select
                value={filterSection}
                onChange={(e) => setFilterSection(e.target.value)}
                className="bg-transparent text-xs font-semibold text-[#172033] focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Corridor Sections</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Tab Selector */}
          <div className="flex items-center bg-[#EAEFF5] p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('network')}
              className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'network'
                  ? 'bg-white text-[#173F7A] shadow-xs'
                  : 'text-[#667085] hover:text-[#172033]'
              }`}
            >
              Task Relationships ({data?.edges.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('bundles')}
              className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'bundles'
                  ? 'bg-white text-[#173F7A] shadow-xs'
                  : 'text-[#667085] hover:text-[#172033]'
              }`}
            >
              Joint Bundles ({data?.joint_candidates.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('matrix')}
              className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'matrix'
                  ? 'bg-white text-[#173F7A] shadow-xs'
                  : 'text-[#667085] hover:text-[#172033]'
              }`}
            >
              Statutory RDSO Policies
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-[#667085]">
          <span className="inline-block w-4 h-4 border-2 border-[#173F7A] border-t-transparent rounded-full animate-spin mr-2" />
          Analyzing inter-department co-location compatibility graph...
        </div>
      ) : (
        <div className="p-5 space-y-5">
          {/* TAB 1: TASK RELATIONSHIPS NETWORK */}
          {activeTab === 'network' && (
            <div className="space-y-4">
              {/* Filter pills */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-[#667085]">Filter Relationships:</span>
                  <button
                    onClick={() => setRelationshipFilter('all')}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                      relationshipFilter === 'all'
                        ? 'bg-[#173F7A] text-white'
                        : 'bg-slate-100 text-[#667085] hover:bg-slate-200'
                    }`}
                  >
                    All ({data?.edges.length || 0})
                  </button>
                  <button
                    onClick={() => setRelationshipFilter('compatible')}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                      relationshipFilter === 'compatible'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                    }`}
                  >
                    Safe Joint Candidates ({data?.edges.filter((e) => e.relationship === 'compatible').length || 0})
                  </button>
                  <button
                    onClick={() => setRelationshipFilter('conflict')}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                      relationshipFilter === 'conflict'
                        ? 'bg-red-600 text-white'
                        : 'bg-red-50 text-red-800 border border-red-200 hover:bg-red-100'
                    }`}
                  >
                    Safety Conflicts ({data?.edges.filter((e) => e.relationship === 'conflict').length || 0})
                  </button>
                </div>

                <span className="text-[11px] font-mono text-[#667085]">
                  Evaluated {data?.total_tasks || 0} active corridor tasks
                </span>
              </div>

              {filteredEdges.length === 0 ? (
                <div className="p-8 text-center bg-[#F8FAFC] border border-dashed border-[#D9E1EA] rounded-xl text-[#667085]">
                  No matching relationship edges found for the selected filter.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredEdges.map((edge, idx) => {
                    const taskA = data?.nodes.find((n) => n.id === edge.source);
                    const taskB = data?.nodes.find((n) => n.id === edge.target);
                    const isCompat = edge.relationship === 'compatible';
                    const isConflict = edge.relationship === 'conflict';
                    const deptA = getDeptColor(taskA?.department || 'ENG');
                    const deptB = getDeptColor(taskB?.department || 'TRD');

                    return (
                      <div
                        key={`${edge.source}-${edge.target}-${idx}`}
                        className={`p-3.5 rounded-xl border transition-all ${
                          isCompat
                            ? 'bg-emerald-50/40 border-emerald-200 hover:border-emerald-400'
                            : isConflict
                            ? 'bg-red-50/40 border-red-200 hover:border-red-400'
                            : 'bg-amber-50/40 border-amber-200'
                        }`}
                      >
                        {/* Edge Top Badge */}
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-black/5">
                          <span className="text-[10px] font-mono font-bold text-[#667085]">
                            {edge.section_name}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${
                              isCompat
                                ? 'bg-emerald-100 text-emerald-800'
                                : isConflict
                                ? 'bg-red-100 text-red-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {isCompat ? (
                              <>
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Joint Block Compatible</span>
                              </>
                            ) : isConflict ? (
                              <>
                                <AlertTriangle className="w-3 h-3" />
                                <span>Safety Conflict (Mutual Exclusion)</span>
                              </>
                            ) : (
                              <span>Precedence Dependency</span>
                            )}
                          </span>
                        </div>

                        {/* Two Connected Tasks */}
                        <div className="flex items-center justify-between gap-2 text-xs">
                          {/* Task A Node */}
                          <div
                            onClick={() => taskA && onSelectTask?.(taskA.id)}
                            className={`flex-1 p-2 rounded-lg border ${deptA.bg} ${deptA.border} cursor-pointer hover:shadow-xs`}
                          >
                            <div className="flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${deptA.dot}`} />
                              <span className="font-mono font-bold text-[#172033]">
                                {taskA?.task_code}
                              </span>
                              <span className="text-[9px] px-1 rounded bg-white/80 font-bold text-[#667085]">
                                {taskA?.department}
                              </span>
                            </div>
                            <div className="text-[11px] font-medium text-[#172033] truncate mt-1">
                              {taskA?.maintenance_type}
                            </div>
                            <div className="text-[10px] font-mono text-[#667085] mt-0.5">
                              Duration: {taskA?.duration}m
                            </div>
                          </div>

                          {/* Relationship Connector */}
                          <div className="flex flex-col items-center justify-center px-1">
                            <span className="text-base font-bold text-[#667085]">
                              {isCompat ? '⟷' : '⚡'}
                            </span>
                          </div>

                          {/* Task B Node */}
                          <div
                            onClick={() => taskB && onSelectTask?.(taskB.id)}
                            className={`flex-1 p-2 rounded-lg border ${deptB.bg} ${deptB.border} cursor-pointer hover:shadow-xs`}
                          >
                            <div className="flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${deptB.dot}`} />
                              <span className="font-mono font-bold text-[#172033]">
                                {taskB?.task_code}
                              </span>
                              <span className="text-[9px] px-1 rounded bg-white/80 font-bold text-[#667085]">
                                {taskB?.department}
                              </span>
                            </div>
                            <div className="text-[11px] font-medium text-[#172033] truncate mt-1">
                              {taskB?.maintenance_type}
                            </div>
                            <div className="text-[10px] font-mono text-[#667085] mt-0.5">
                              Duration: {taskB?.duration}m
                            </div>
                          </div>
                        </div>

                        {/* Rationale Note */}
                        {edge.notes && (
                          <div className="mt-2 text-[10px] text-[#475467] bg-white/70 p-1.5 rounded border border-black/5">
                            <strong>Rule Inference:</strong> {edge.notes}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: JOINT BUNDLE CLUSTERS */}
          {activeTab === 'bundles' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-[#172033]">
                    Algorithmically Identified Joint Block Bundles
                  </h4>
                  <p className="text-[11px] text-[#667085]">
                    Maximal cliques of co-locatable tasks extracted from the NetworkX compatibility graph. Scheduling these tasks simultaneously maximizes track possession efficiency.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded bg-indigo-50 border border-indigo-200 text-indigo-900 font-mono font-bold text-xs">
                  {data?.joint_candidates.length || 0} Candidate Bundles
                </span>
              </div>

              {(!data?.joint_candidates || data.joint_candidates.length === 0) ? (
                <div className="p-8 text-center bg-[#F8FAFC] border border-dashed border-[#D9E1EA] rounded-xl text-[#667085]">
                  No joint bundles currently identified. Ensure multiple tasks on the same section have parallel execution enabled.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {data.joint_candidates.map((cluster, idx) => (
                    <div
                      key={`bundle-${idx}`}
                      className="bg-white rounded-xl border border-indigo-200 p-4 shadow-xs space-y-3 relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 w-2 h-full bg-gradient-to-b from-indigo-500 to-purple-600" />

                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-mono font-bold text-indigo-700 uppercase tracking-wider block">
                            Joint Block Bundle #{idx + 1}
                          </span>
                          <span className="text-sm font-bold text-[#172033]">
                            {cluster.section_name}
                          </span>
                        </div>

                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          cluster.is_cross_department
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {cluster.is_cross_department ? 'Multi-Department Co-location' : 'Same-Dept Parallel Bundle'}
                        </span>
                      </div>

                      {/* Tasks in Bundle */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold text-[#667085] uppercase">
                          Co-Located Work Orders ({cluster.tasks.length}):
                        </span>
                        {cluster.tasks.map((task) => {
                          const deptStyle = getDeptColor(task.dept);
                          return (
                            <div
                              key={task.id}
                              className={`p-2 rounded border flex items-center justify-between ${deptStyle.bg} ${deptStyle.border}`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span className={`w-2 h-2 rounded-full ${deptStyle.dot}`} />
                                <span className="font-mono font-bold text-[#172033]">
                                  {task.code}
                                </span>
                                <span className="text-[#172033] truncate font-medium">
                                  {task.title}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-[#667085] flex-shrink-0">
                                <span>{task.duration}m</span>
                                {task.power_cut && (
                                  <span className="px-1 rounded bg-amber-100 text-amber-800 text-[9px]">
                                    25kV Cut
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Summary Metrics */}
                      <div className="pt-2 border-t border-[#D9E1EA] flex items-center justify-between text-[11px] text-[#667085] font-mono">
                        <span>Required Window: <strong>{cluster.max_duration} min</strong></span>
                        <span className="text-emerald-700 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Solver Co-location Verified
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: STATUTORY RDSO POLICIES */}
          {activeTab === 'matrix' && (
            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-[#172033]">
                  Indian Railways Inter-Department Co-Location Safety Standards
                </h4>
                <p className="text-[11px] text-[#667085]">
                  Statutory rules governing concurrent execution across Civil Engineering (P-Way), Traction Distribution (TRD), and Signalling & Telecom (S&T).
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(data?.department_matrix || []).map((policy, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border border-[#D9E1EA] bg-[#F8FAFC] space-y-2.5 shadow-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-sm text-[#173F7A]">
                        {policy.dept_pair}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        policy.status === 'Recommended'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {policy.status}
                      </span>
                    </div>

                    <div className="font-bold text-[#172033] text-xs">
                      {policy.name}
                    </div>

                    <div className="text-[11px] text-[#475467] leading-relaxed">
                      {policy.safety_protocol}
                    </div>

                    <div className="pt-2 border-t border-[#D9E1EA] text-[10px] font-bold text-emerald-800 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{policy.compatibility}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
