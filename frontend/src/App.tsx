import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { PlanningProvider } from './context/PlanningContext';
import AppShell from './components/AppShell';
import Overview from './pages/Overview';
import StubPage from './pages/StubPage';
import MaintenanceDemand from './pages/maintenance/MaintenanceDemand';
import PendingTasks from './pages/maintenance/PendingTasks';
import CriticalDefects from './pages/maintenance/CriticalDefects';
import OverdueWork from './pages/maintenance/OverdueWork';
import CorridorAvailability from './pages/CorridorAvailability';
import PlanningWorkbench from './pages/planning/PlanningWorkbench';
import WeeklyPlan from './pages/planning/WeeklyPlan';
import MonthlyPlan from './pages/planning/MonthlyPlan';
import GanttView from './pages/planning/GanttView';
import PlanComparison from './pages/planning/PlanComparison';
import ReplanningCenter from './pages/planning/ReplanningCenter';
import ConflictsAlerts from './pages/ConflictsAlerts';
import Approvals from './pages/Approvals';
import Reports from './pages/Reports';
import DataSources from './pages/DataSources';

export default function App() {
  return (
    <BrowserRouter>
      <PlanningProvider>
        <AppShell>
          <Routes>
            {/* ── Overview ── */}
            <Route path="/" element={<Overview />} />

            {/* ── Maintenance Demand ── */}
            <Route path="/maintenance/all" element={<MaintenanceDemand defaultFilter="all" />} />
            <Route path="/maintenance/pending" element={<PendingTasks />} />
            <Route path="/maintenance/critical" element={<CriticalDefects />} />
            <Route path="/maintenance/overdue" element={<OverdueWork />} />

            {/* ── Corridor Availability & Capacity ── */}
            <Route path="/corridor" element={<CorridorAvailability />} />

            {/* ── Block Planning & Workstation ── */}
            <Route path="/planning/workbench" element={<PlanningWorkbench />} />
            <Route path="/planning/weekly" element={<WeeklyPlan />} />
            <Route path="/planning/monthly" element={<MonthlyPlan />} />
            <Route path="/planning/gantt" element={<GanttView />} />
            <Route path="/planning/replan" element={<ReplanningCenter />} />
            <Route path="/planning/compare" element={<PlanComparison />} />

            {/* ── Conflicts & Alerts ── */}
            <Route path="/conflicts" element={<ConflictsAlerts />} />

            {/* ── Operating Controller Approvals ── */}
            <Route path="/approvals" element={<Approvals />} />

            {/* ── Official Reports ── */}
            <Route path="/reports" element={<Reports />} />

            {/* ── Data Sources & Transparency ── */}
            <Route path="/data-sources" element={<DataSources />} />

            {/* ── 404 fallback ── */}
            <Route path="*" element={<StubPage title="Page Not Found" />} />
          </Routes>
        </AppShell>
      </PlanningProvider>
    </BrowserRouter>
  );
}
