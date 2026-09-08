/**
 * MaintenanceTaskTable — shared table used by PendingTasks, CriticalDefects, OverdueWork.
 * Row click opens PrioritySlideOver.
 */
import { useState, useEffect, useCallback } from 'react';
import DataTable, { type ColumnDef } from '../ui/DataTable';
import StatusBadge, { type BadgeVariant } from '../ui/StatusBadge';
import Panel from '../ui/Panel';
import FilterBar, { type FilterState } from './FilterBar';
import PrioritySlideOver from './PrioritySlideOver';
import { getTasks, type MaintenanceTask, type TaskFilters } from '../../lib/apiClient';

const TODAY_ISO = '2026-09-07T00:00:00';

function severityVariant(s: string): BadgeVariant {
  if (s === 'Critical') return 'critical';
  if (s === 'High')     return 'critical';
  if (s === 'Medium')   return 'warning';
  return 'neutral';
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: '2-digit',
  });
}

// Dept tag — small coloured label, not a full badge
function DeptTag({ code }: { code: string | null }) {
  const palette: Record<string, string> = {
    ENG: 'bg-blue-50  text-blue-700  border-blue-200',
    TRD: 'bg-amber-50 text-amber-700 border-amber-200',
    SNT: 'bg-green-50 text-green-700 border-green-200',
  };
  const cls = palette[code ?? ''] ?? 'bg-panel text-text-secondary border-border';
  return (
    <span className={`inline-block px-1.5 py-0.5 text-2xs font-semibold rounded border ${cls}`}>
      {code ?? '—'}
    </span>
  );
}

const COLUMNS: ColumnDef<MaintenanceTask>[] = [
  {
    key: 'task_code',
    header: 'Task Code',
    width: 'w-28',
    render: (t) => (
      <span className="font-medium text-text-primary tabular-nums">{t.task_code}</span>
    ),
  },
  {
    key: 'department_code',
    header: 'Dept',
    width: 'w-16',
    render: (t) => <DeptTag code={t.department_code} />,
  },
  {
    key: 'section_name',
    header: 'Section',
    width: 'w-28',
    render: (t) => <span className="text-text-secondary">{t.section_name ?? '—'}</span>,
  },
  {
    key: 'maintenance_type',
    header: 'Type',
    render: (t) => <span className="text-text-secondary text-xs">{t.maintenance_type}</span>,
  },
  {
    key: 'severity',
    header: 'Severity',
    width: 'w-24',
    render: (t) => <StatusBadge variant={severityVariant(t.severity)} label={t.severity} />,
  },
  {
    key: 'due_date',
    header: 'Due Date',
    width: 'w-24',
    render: (t) => {
      const overdue = t.due_date && t.due_date < TODAY_ISO;
      return (
        <span className={`tabular-nums text-xs ${overdue ? 'text-status-critical-text font-semibold' : ''}`}>
          {fmtDate(t.due_date)}
        </span>
      );
    },
  },
  {
    key: 'priority_score',
    header: 'Priority',
    numeric: true,
    width: 'w-20',
    render: (t) => (
      <span className={`tabular-nums text-sm ${(t.priority_score ?? 0) > 75 ? 'font-bold text-text-primary' : 'text-text-secondary'}`}>
        {t.priority_score != null ? t.priority_score.toFixed(1) : '—'}
      </span>
    ),
  },
];

interface MaintenanceTaskTableProps {
  /** Base API filters pre-applied (e.g. {status:'Pending'} for PendingTasks page) */
  baseFilters: TaskFilters;
  /** Page title shown inside the Panel */
  title: string;
  /** Empty state message */
  emptyMessage?: string;
}

export default function MaintenanceTaskTable({
  baseFilters,
  title,
  emptyMessage = 'No tasks match the current filters.',
}: MaintenanceTaskTableProps) {
  const [tasks,   setTasks]   = useState<MaintenanceTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<MaintenanceTask | null>(null);

  const [filters, setFilters] = useState<FilterState>({
    department:  '',
    sectionId:   '',
    minPriority: 0,
  });

  const load = useCallback(() => {
    setLoading(true);
    const combined: TaskFilters = {
      ...baseFilters,
      ...(filters.department  ? { department: filters.department }    : {}),
      ...(filters.sectionId   ? { section_id: filters.sectionId }     : {}),
      ...(filters.minPriority > 0 ? { min_priority: filters.minPriority } : {}),
    };
    getTasks(combined)
      .then(setTasks)
      .catch(() => setTasks([]))
      .finally(() => setLoading(false));
  }, [baseFilters, filters]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <FilterBar value={filters} onChange={setFilters} />

      <Panel
        title={`${title} (${loading ? '…' : tasks.length})`}
        className="overflow-hidden"
      >
        <DataTable
          columns={COLUMNS}
          rows={tasks}
          rowKey={(t) => t.id}
          loading={loading}
          emptyMessage={emptyMessage}
          onRowClick={(t) => setSelected((prev) => prev?.id === t.id ? null : t)}
        />
      </Panel>

      <PrioritySlideOver
        task={selected}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
