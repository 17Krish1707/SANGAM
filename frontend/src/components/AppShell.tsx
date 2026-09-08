import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Wrench,
  Train,
  Calendar,
  AlertTriangle,
  RotateCcw,
  GitCompare,
  CheckSquare,
  FileText,
  Database,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import DemoJourneyDrawer from './DemoJourneyDrawer';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  to?: string;
  children?: { label: string; to: string }[];
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Operations Overview',
    icon: <LayoutDashboard className="w-4 h-4" />,
    to: '/',
  },
  {
    label: 'Maintenance Demand',
    icon: <Wrench className="w-4 h-4" />,
    children: [
      { label: 'All Tasks Register', to: '/maintenance/all' },
      { label: 'Critical Defects', to: '/maintenance/critical' },
      { label: 'Overdue Work',     to: '/maintenance/overdue' },
    ],
  },
  {
    label: 'Corridor Capacity',
    icon: <Train className="w-4 h-4" />,
    to: '/corridor',
  },
  {
    label: 'Block Planning',
    icon: <Calendar className="w-4 h-4" />,
    children: [
      { label: 'Planning Workbench ★', to: '/planning/workbench' },
      { label: 'Weekly Plan',         to: '/planning/weekly' },
      { label: 'Monthly Plan',        to: '/planning/monthly' },
      { label: 'Gantt View',          to: '/planning/gantt' },
    ],
  },
  {
    label: 'Conflicts & Constraints',
    icon: <AlertTriangle className="w-4 h-4" />,
    to: '/conflicts',
  },
  {
    label: 'Re-planning',
    icon: <RotateCcw className="w-4 h-4" />,
    to: '/planning/replan',
  },
  {
    label: 'Plan Comparison',
    icon: <GitCompare className="w-4 h-4" />,
    to: '/planning/compare',
  },
  {
    label: 'Approvals Desk',
    icon: <CheckSquare className="w-4 h-4" />,
    to: '/approvals',
  },
  {
    label: 'Planning Reports',
    icon: <FileText className="w-4 h-4" />,
    to: '/reports',
  },
  {
    label: 'Data Sources',
    icon: <Database className="w-4 h-4" />,
    to: '/data-sources',
  },
];

function NavGroup({ item }: { item: NavItem }) {
  const location = useLocation();
  const isChildActive = item.children?.some((c) => location.pathname.startsWith(c.to)) ?? false;
  const [open, setOpen] = useState(isChildActive);

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`
          w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium
          transition-colors duration-100
          ${isChildActive
            ? 'text-accent font-semibold bg-accent-tint'
            : 'text-text-secondary hover:text-text-primary hover:bg-panel'}
        `}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2.5">
          <span className={isChildActive ? 'text-accent' : 'text-text-secondary'}>{item.icon}</span>
          {item.label}
        </span>
        {open ? <ChevronDown className="w-3.5 h-3.5 text-text-secondary" /> : <ChevronRight className="w-3.5 h-3.5 text-text-secondary" />}
      </button>

      {open && (
        <div className="mt-0.5 ml-4 pl-3 border-l border-border space-y-0.5">
          {item.children!.map((child) => (
            <NavLink
              key={child.to}
              to={child.to}
              className={({ isActive }) => `
                block px-2 py-1.5 rounded-md text-xs transition-colors duration-100
                ${isActive
                  ? 'text-accent font-bold bg-accent-tint border-r-2 border-accent'
                  : 'text-text-secondary hover:text-text-primary hover:bg-panel'}
              `}
            >
              {child.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

function NavSingleItem({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to!}
      end={item.to === '/'}
      className={({ isActive }) => `
        flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors duration-100
        ${isActive
          ? 'text-accent font-bold bg-accent-tint border-l-2 border-accent -ml-px pl-[calc(0.75rem-1px)]'
          : 'text-text-secondary hover:text-text-primary hover:bg-panel'}
      `}
    >
      {({ isActive }) => (
        <>
          <span className={isActive ? 'text-accent' : 'text-text-secondary'}>{item.icon}</span>
          {item.label}
        </>
      )}
    </NavLink>
  );
}

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-page text-text-primary">
      {/* ── Left Sidebar ── */}
      <aside className="w-64 flex-shrink-0 flex flex-col border-r border-border bg-white select-none">
        {/* Brand Header */}
        <div className="h-14 flex items-center justify-between px-5 border-b border-border flex-shrink-0 bg-white">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-accent flex items-center justify-center text-white font-black text-sm tracking-tight shadow-xs">
              S
            </div>
            <div>
              <span className="text-sm font-bold tracking-tight text-accent block leading-none">
                SANGAM
              </span>
              <span className="text-[10px] font-mono text-text-secondary block leading-tight mt-0.5">
                Block Planning System
              </span>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-panel border border-border text-text-secondary">
            v2.6
          </span>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5" aria-label="Main navigation">
          {NAV_ITEMS.map((item) =>
            item.children ? (
              <NavGroup key={item.label} item={item} />
            ) : (
              <NavSingleItem key={item.label} item={item} />
            )
          )}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border flex-shrink-0 bg-panel text-[11px] text-text-secondary">
          <div className="flex items-center justify-between font-mono">
            <span>SIH26027</span>
            <span>Central Div.</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Indian Railways Joint Block Planner
          </div>
        </div>
      </aside>

      {/* ── Main Workspace ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-panel">
        {children}
      </div>

      {/* ── Judge Demo Flow Drawer ── */}
      <DemoJourneyDrawer />
    </div>
  );
}
