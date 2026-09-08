import React from 'react';
import { NavLink } from 'react-router-dom';
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
  Clock,
} from 'lucide-react';
import DemoJourneyDrawer from './DemoJourneyDrawer';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  to?: string;
  children?: { label: string; to: string }[];
}

interface NavCategory {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavCategory[] = [
  {
    title: 'OVERVIEW',
    items: [
      {
        label: 'Operations Overview',
        icon: <LayoutDashboard className="w-4 h-4" />,
        to: '/',
      },
    ],
  },
  {
    title: 'PLANNING INPUTS',
    items: [
      {
        label: 'Maintenance Work',
        icon: <Wrench className="w-4 h-4" />,
        to: '/maintenance',
      },
      {
        label: 'Train & Corridor Data',
        icon: <Train className="w-4 h-4" />,
        to: '/corridor-data',
      },
      {
        label: 'Resources',
        icon: <CheckSquare className="w-4 h-4" />,
        to: '/resources',
      },
    ],
  },
  {
    title: 'BLOCK PLANNING',
    items: [
      {
        label: 'Create Block Plan',
        icon: <Calendar className="w-4 h-4" />,
        to: '/planning/create',
      },
      {
        label: 'Proposed Plan',
        icon: <Clock className="w-4 h-4" />,
        to: '/planning/proposed',
      },
      {
        label: 'Compare Plans',
        icon: <GitCompare className="w-4 h-4" />,
        to: '/planning/compare',
      },
    ],
  },
  {
    title: 'OPERATIONS',
    items: [
      {
        label: 'Conflicts & Exceptions',
        icon: <AlertTriangle className="w-4 h-4" />,
        to: '/operations/conflicts',
      },
      {
        label: 'Approved Blocks',
        icon: <CheckSquare className="w-4 h-4" />,
        to: '/operations/approved',
      },
      {
        label: 'Operational Re-plan',
        icon: <RotateCcw className="w-4 h-4" />,
        to: '/operations/replan',
      },
    ],
  },
  {
    title: 'ADMIN / DATA',
    items: [
      {
        label: 'Data Sources',
        icon: <Database className="w-4 h-4" />,
        to: '/data-sources',
      },
      {
        label: 'Planning Rules',
        icon: <FileText className="w-4 h-4" />,
        to: '/rules',
      },
    ],
  },
  {
    title: 'REPORTS',
    items: [
      {
        label: 'Sanction Reports',
        icon: <FileText className="w-4 h-4" />,
        to: '/reports',
      },
    ],
  },
];

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
        <nav className="flex-1 overflow-y-auto p-3 space-y-3.5" aria-label="Main navigation">
          {NAV_SECTIONS.map((sec) => (
            <div key={sec.title} className="space-y-1">
              <div className="px-3 pt-1 text-[9px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                {sec.title}
              </div>
              <div className="space-y-0.5">
                {sec.items.map((item) => (
                  <NavSingleItem key={item.label} item={item} />
                ))}
              </div>
            </div>
          ))}
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
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-page" id="main-content">
        {children}
      </main>

      {/* ── Judge Demo Flow Drawer ── */}
      <DemoJourneyDrawer />
    </div>
  );
}
