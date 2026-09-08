import { useState, useEffect, useMemo } from 'react';
import TopBar from '../../components/TopBar';
import Panel from '../../components/ui/Panel';
import StatusBadge, { type BadgeVariant } from '../../components/ui/StatusBadge';
import {
  getTasks,
  getSections,
  type MaintenanceTask,
  type Section,
} from '../../lib/apiClient';
import TaskIntelligenceDrawer from '../../components/maintenance/TaskIntelligenceDrawer';
import {
  Wrench,
  Zap,
  Radio,
  Search,
  Sparkles,
} from 'lucide-react';

const TODAY_ISO = '2026-09-07T00:00:00';

interface MaintenanceDemandProps {
  defaultFilter?: 'all' | 'critical' | 'overdue';
}

export default function MaintenanceDemand({ defaultFilter = 'all' }: MaintenanceDemandProps) {
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Filters
  const [deptFilter, setDeptFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>(
    defaultFilter === 'critical' ? 'Critical' : 'ALL'
  );
  const [sectionFilter, setSectionFilter] = useState<string>('ALL');
  const [overdueOnly, setOverdueOnly] = useState<boolean>(defaultFilter === 'overdue');
  const [isolationOnly, setIsolationOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    Promise.all([getTasks(), getSections()])
      .then(([taskList, secList]) => {
        setTasks(taskList);
        setSections(secList);
      })
      .catch((err) => console.error('Failed loading maintenance tasks', err))
      .finally(() => setLoading(false));
  }, []);

  // Department Stats
  const deptStats = useMemo(() => {
    const stats = {
      ENG: { count: 0, hours: 0, critical: 0 },
      TRD: { count: 0, hours: 0, critical: 0 },
      SNT: { count: 0, hours: 0, critical: 0 },
    };

    tasks.forEach((t) => {
      const d = (t.department_code || 'ENG') as keyof typeof stats;
      if (stats[d]) {
        stats[d].count += 1;
        stats[d].hours += (t.estimated_duration_min || 120) / 60;
        if (t.severity === 'Critical') stats[d].critical += 1;
      }
    });

    return stats;
  }, [tasks]);

  // Filtered Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (deptFilter !== 'ALL' && t.department_code !== deptFilter) return false;
      if (severityFilter !== 'ALL' && t.severity !== severityFilter) return false;
      if (sectionFilter !== 'ALL' && t.section_id !== sectionFilter) return false;
      if (overdueOnly) {
        const isOverdue = t.due_date && t.due_date < TODAY_ISO;
        if (!isOverdue) return false;
      }
      if (isolationOnly && !t.requires_power_isolation) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchCode = t.task_code?.toLowerCase().includes(q);
        const matchType = t.maintenance_type?.toLowerCase().includes(q);
        const matchSec = t.section_name?.toLowerCase().includes(q);
        if (!matchCode && !matchType && !matchSec) return false;
      }
      return true;
    });
  }, [tasks, deptFilter, severityFilter, sectionFilter, overdueOnly, isolationOnly, searchQuery]);

  function severityBadgeVariant(s: string): BadgeVariant {
    if (s === 'Critical' || s === 'High') return 'critical';
    if (s === 'Medium') return 'warning';
    return 'neutral';
  }

  return (
    <>
      <TopBar
        title="Maintenance Demand Register"
        subtitle="Cross-Department Work Orders & Pre-Optimization Intelligence"
      />

      <main className="flex-1 overflow-y-auto bg-panel p-6 space-y-5">
        {/* Synthetic Data Alert Banner */}
        <div className="bg-blue-50/70 border border-blue-200 rounded-lg px-4 py-2.5 flex items-center justify-between text-xs text-blue-900">
          <div className="flex items-center gap-2">
            <span className="font-mono px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold">
              TMS / SMMS / TDMS FEED
            </span>
            <span>
              Synthetic multi-department backlog calibrated to SIH 26027 specifications (Seed 26027: 120 total tasks across 5 corridor sections).
            </span>
          </div>
          <span className="font-mono text-blue-700 text-2xs font-semibold">
            Status: Synchronized
          </span>
        </div>

        {/* ── 3 Department Demand Visual Lanes ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Engineering */}
          <div
            onClick={() => setDeptFilter(deptFilter === 'ENG' ? 'ALL' : 'ENG')}
            className={`cursor-pointer bg-white rounded-lg border-2 p-4 transition-all duration-150 shadow-xs ${
              deptFilter === 'ENG'
                ? 'border-blue-600 ring-2 ring-blue-100'
                : 'border-border hover:border-blue-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-md bg-blue-50 text-blue-700 flex items-center justify-center">
                  <Wrench className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                    Track & Civil (ENG)
                  </h3>
                  <p className="text-2xs text-text-secondary">Track, welding, tampers & switches</p>
                </div>
              </div>
              <span className="text-xl font-bold font-mono text-blue-700">
                {deptStats.ENG.count}
              </span>
            </div>
            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs font-mono">
              <span className="text-text-secondary">
                Hours: <strong className="text-text-primary">{deptStats.ENG.hours.toFixed(1)}h</strong>
              </span>
              <span className="text-status-critical-text font-bold">
                {deptStats.ENG.critical} Critical
              </span>
            </div>
          </div>

          {/* TRD */}
          <div
            onClick={() => setDeptFilter(deptFilter === 'TRD' ? 'ALL' : 'TRD')}
            className={`cursor-pointer bg-white rounded-lg border-2 p-4 transition-all duration-150 shadow-xs ${
              deptFilter === 'TRD'
                ? 'border-amber-500 ring-2 ring-amber-100'
                : 'border-border hover:border-amber-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-md bg-amber-50 text-amber-700 flex items-center justify-center">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                    Traction / OHE (TRD)
                  </h3>
                  <p className="text-2xs text-text-secondary">Catenary, mast, 25kV power isolation</p>
                </div>
              </div>
              <span className="text-xl font-bold font-mono text-amber-700">
                {deptStats.TRD.count}
              </span>
            </div>
            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs font-mono">
              <span className="text-text-secondary">
                Hours: <strong className="text-text-primary">{deptStats.TRD.hours.toFixed(1)}h</strong>
              </span>
              <span className="text-status-critical-text font-bold">
                {deptStats.TRD.critical} Critical
              </span>
            </div>
          </div>

          {/* S&T */}
          <div
            onClick={() => setDeptFilter(deptFilter === 'SNT' ? 'ALL' : 'SNT')}
            className={`cursor-pointer bg-white rounded-lg border-2 p-4 transition-all duration-150 shadow-xs ${
              deptFilter === 'SNT'
                ? 'border-indigo-600 ring-2 ring-indigo-100'
                : 'border-border hover:border-indigo-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-md bg-indigo-50 text-indigo-700 flex items-center justify-center">
                  <Radio className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                    Signalling & Telecom (S&T)
                  </h3>
                  <p className="text-2xs text-text-secondary">Point machines, track circuits, signals</p>
                </div>
              </div>
              <span className="text-xl font-bold font-mono text-indigo-700">
                {deptStats.SNT.count}
              </span>
            </div>
            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs font-mono">
              <span className="text-text-secondary">
                Hours: <strong className="text-text-primary">{deptStats.SNT.hours.toFixed(1)}h</strong>
              </span>
              <span className="text-status-critical-text font-bold">
                {deptStats.SNT.critical} Critical
              </span>
            </div>
          </div>
        </div>

        {/* ── Filter Controls ── */}
        <Panel className="p-3">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-text-secondary" />
                <input
                  type="text"
                  placeholder="Search code, type, section..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded border border-border bg-white text-xs text-text-primary focus:outline-none focus:border-accent w-48 font-mono"
                />
              </div>

              {/* Department */}
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded border border-border bg-white text-xs font-medium text-text-primary focus:outline-none"
              >
                <option value="ALL">All Departments</option>
                <option value="ENG">Civil / Engineering (ENG)</option>
                <option value="TRD">Traction / OHE (TRD)</option>
                <option value="SNT">Signal & Telecom (S&T)</option>
              </select>

              {/* Severity */}
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded border border-border bg-white text-xs font-medium text-text-primary focus:outline-none"
              >
                <option value="ALL">All Severities</option>
                <option value="Critical">Critical Only</option>
                <option value="High">High Only</option>
                <option value="Medium">Medium Only</option>
                <option value="Low">Low Only</option>
              </select>

              {/* Section */}
              <select
                value={sectionFilter}
                onChange={(e) => setSectionFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded border border-border bg-white text-xs font-medium text-text-primary focus:outline-none"
              >
                <option value="ALL">All Sections</option>
                {sections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.name} ({sec.from_station} - {sec.to_station})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 cursor-pointer select-none text-text-secondary hover:text-text-primary">
                <input
                  type="checkbox"
                  checked={overdueOnly}
                  onChange={(e) => setOverdueOnly(e.target.checked)}
                  className="rounded border-border text-accent focus:ring-accent w-3.5 h-3.5"
                />
                <span className="font-semibold text-status-critical-text">Overdue Only</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer select-none text-text-secondary hover:text-text-primary">
                <input
                  type="checkbox"
                  checked={isolationOnly}
                  onChange={(e) => setIsolationOnly(e.target.checked)}
                  className="rounded border-border text-accent focus:ring-accent w-3.5 h-3.5"
                />
                <span>Power Block (OHE)</span>
              </label>

              {(deptFilter !== 'ALL' || severityFilter !== 'ALL' || sectionFilter !== 'ALL' || overdueOnly || isolationOnly || searchQuery) && (
                <button
                  onClick={() => {
                    setDeptFilter('ALL');
                    setSeverityFilter('ALL');
                    setSectionFilter('ALL');
                    setOverdueOnly(false);
                    setIsolationOnly(false);
                    setSearchQuery('');
                  }}
                  className="text-2xs text-accent hover:underline font-medium"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        </Panel>

        {/* ── Table & Interactive Selection ── */}
        <Panel
          title={
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <span>Task Work Orders</span>
                <span className="text-2xs font-mono px-2 py-0.5 rounded bg-panel text-text-secondary border border-border">
                  Showing {filteredTasks.length} of {tasks.length}
                </span>
              </div>
              <span className="text-2xs text-text-secondary font-mono">
                Click any row to open Deep Intelligence &amp; Multi-Factor Score
              </span>
            </div>
          }
        >
          {loading ? (
            <div className="p-12 text-center text-text-secondary text-xs animate-pulse">
              Loading maintenance tasks register from database...
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="p-12 text-center text-text-secondary text-xs">
              No maintenance work orders match the current filter criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-panel text-[11px] text-text-secondary uppercase tracking-wider font-semibold">
                    <th className="py-2.5 px-3">Code</th>
                    <th className="py-2.5 px-3">Dept</th>
                    <th className="py-2.5 px-3">Section</th>
                    <th className="py-2.5 px-3">Maintenance Description</th>
                    <th className="py-2.5 px-3">Severity</th>
                    <th className="py-2.5 px-3">Due Date</th>
                    <th className="py-2.5 px-3">Duration</th>
                    <th className="py-2.5 px-3">OHE Req</th>
                    <th className="py-2.5 px-3 text-right">Priority</th>
                    <th className="py-2.5 px-3 text-center">Intel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredTasks.map((t) => {
                    const isOverdue = t.due_date && t.due_date < TODAY_ISO;
                    const isSelected = selectedTaskId === t.id;

                    const deptBadge =
                      t.department_code === 'ENG'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : t.department_code === 'TRD'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-indigo-50 text-indigo-700 border-indigo-200';

                    return (
                      <tr
                        key={t.id}
                        onClick={() => setSelectedTaskId(isSelected ? null : t.id)}
                        className={`cursor-pointer transition-colors duration-100 ${
                          isSelected
                            ? 'bg-blue-50/60 font-medium'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-2 px-3 font-mono font-bold text-accent">
                          {t.task_code}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`inline-block px-1.5 py-0.5 text-2xs font-bold rounded border ${deptBadge}`}
                          >
                            {t.department_code}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-text-secondary font-medium">
                          {t.section_name || 'Corridor Section'}
                        </td>
                        <td className="py-2 px-3 text-text-primary">
                          <div className="font-semibold">{t.maintenance_type}</div>
                          <div className="text-2xs text-text-secondary line-clamp-1">
                            {t.asset_name || 'Corridor track asset'}
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <StatusBadge
                            variant={severityBadgeVariant(t.severity)}
                            label={t.severity}
                          />
                        </td>
                        <td className="py-2 px-3 font-mono text-2xs">
                          <span
                            className={
                              isOverdue
                                ? 'text-status-critical-text font-bold bg-red-50 px-1 py-0.5 rounded border border-red-200'
                                : 'text-text-secondary'
                            }
                          >
                            {t.due_date ? t.due_date.slice(0, 10) : '—'}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-mono text-text-primary">
                          {((t.estimated_duration_min || 120) / 60).toFixed(1)}h
                        </td>
                        <td className="py-2 px-3">
                          {t.requires_power_isolation ? (
                            <span className="inline-flex items-center gap-1 text-2xs font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              <Zap className="w-3 h-3" /> 25kV
                            </span>
                          ) : (
                            <span className="text-2xs text-text-secondary">—</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold">
                          <span
                            className={
                              (t.priority_score ?? 0) >= 80
                                ? 'text-status-critical-text text-sm'
                                : (t.priority_score ?? 0) >= 60
                                ? 'text-amber-700'
                                : 'text-text-secondary'
                            }
                          >
                            {t.priority_score ? t.priority_score.toFixed(1) : '—'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTaskId(t.id);
                            }}
                            className="p-1 rounded hover:bg-white text-text-secondary hover:text-accent"
                            title="Inspect Task Intelligence"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-accent" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </main>

      {/* ── Slide-over Intelligence Drawer ── */}
      <TaskIntelligenceDrawer
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
      />
    </>
  );
}
