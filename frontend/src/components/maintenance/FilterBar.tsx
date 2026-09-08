/**
 * FilterBar — Department / Section / Min-Priority filters
 * shared across all three maintenance pages.
 */
import { useEffect, useState } from 'react';
import Panel from '../ui/Panel';
import { getSections, type Section } from '../../lib/apiClient';

export interface FilterState {
  department: string;   // '' = all
  sectionId:  string;   // '' = all
  minPriority: number;  // 0 = no filter
}

interface FilterBarProps {
  value: FilterState;
  onChange: (f: FilterState) => void;
}

const DEPARTMENTS = [
  { code: '', label: 'All Departments' },
  { code: 'ENG', label: 'Engineering' },
  { code: 'TRD', label: 'Traction' },
  { code: 'SNT', label: 'S&T' },
];

export default function FilterBar({ value, onChange }: FilterBarProps) {
  const [sections, setSections] = useState<Section[]>([]);

  useEffect(() => {
    getSections().then(setSections).catch(() => {});
  }, []);

  function set<K extends keyof FilterState>(key: K, val: FilterState[K]) {
    onChange({ ...value, [key]: val });
  }

  return (
    <Panel className="mb-4">
      <div className="flex flex-wrap items-end gap-4">

        {/* Department */}
        <div className="flex flex-col gap-1 min-w-[160px]">
          <label className="text-xs font-medium text-text-secondary">Department</label>
          <select
            value={value.department}
            onChange={(e) => set('department', e.target.value)}
            className="text-sm border border-border rounded-md px-3 py-1.5 bg-white text-text-primary
                       focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1"
          >
            {DEPARTMENTS.map((d) => (
              <option key={d.code} value={d.code}>{d.label}</option>
            ))}
          </select>
        </div>

        {/* Section */}
        <div className="flex flex-col gap-1 min-w-[180px]">
          <label className="text-xs font-medium text-text-secondary">Section</label>
          <select
            value={value.sectionId}
            onChange={(e) => set('sectionId', e.target.value)}
            className="text-sm border border-border rounded-md px-3 py-1.5 bg-white text-text-primary
                       focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1"
          >
            <option value="">All Sections</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* Min Priority */}
        <div className="flex flex-col gap-1 min-w-[140px]">
          <label className="text-xs font-medium text-text-secondary">
            Min Priority Score
            <span className="ml-1 font-semibold text-text-primary tabular-nums">
              {value.minPriority > 0 ? value.minPriority : '—'}
            </span>
          </label>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={value.minPriority}
            onChange={(e) => set('minPriority', Number(e.target.value))}
            className="w-full accent-accent"
          />
        </div>

        {/* Reset */}
        {(value.department || value.sectionId || value.minPriority > 0) && (
          <button
            onClick={() => onChange({ department: '', sectionId: '', minPriority: 0 })}
            className="text-xs text-text-secondary hover:text-text-primary underline pb-1.5"
          >
            Reset filters
          </button>
        )}
      </div>
    </Panel>
  );
}
