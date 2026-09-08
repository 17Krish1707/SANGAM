import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { PlanningProvider } from './context/PlanningContext';
import AppShell from './components/AppShell';

// Overview
import Overview from './pages/Overview';

// Planning Inputs
import MaintenanceWork from './pages/maintenance/MaintenanceWork';
import TrainCorridorData from './pages/corridor/TrainCorridorData';
import ResourceManagement from './pages/resources/ResourceManagement';

// Block Planning
import CreateBlockPlan from './pages/planning/CreateBlockPlan';
import ProposedPlan from './pages/planning/ProposedPlan';
import PlanComparison from './pages/planning/PlanComparison';

// Operations
import ConflictsExceptions from './pages/operations/ConflictsExceptions';
import ApprovedBlocks from './pages/operations/ApprovedBlocks';
import ReplanningOperations from './pages/operations/ReplanningOperations';

// Admin & Reports
import PlanningRules from './pages/admin/PlanningRules';
import DataSources from './pages/DataSources';
import Reports from './pages/Reports';

// Fallback
import StubPage from './pages/StubPage';

export default function App() {
  return (
    <BrowserRouter>
      <PlanningProvider>
        <AppShell>
          <Routes>
            {/* ── Overview ── */}
            <Route path="/" element={<Overview />} />

            {/* ── Planning Inputs ── */}
            <Route path="/maintenance" element={<MaintenanceWork />} />
            <Route path="/corridor-data" element={<TrainCorridorData />} />
            <Route path="/resources" element={<ResourceManagement />} />

            {/* ── Block Planning ── */}
            <Route path="/planning/create" element={<CreateBlockPlan />} />
            <Route path="/planning/proposed" element={<ProposedPlan />} />
            <Route path="/planning/compare" element={<PlanComparison />} />

            {/* ── Operations ── */}
            <Route path="/operations/conflicts" element={<ConflictsExceptions />} />
            <Route path="/operations/approved" element={<ApprovedBlocks />} />
            <Route path="/operations/replan" element={<ReplanningOperations />} />

            {/* ── Admin & Reports ── */}
            <Route path="/data-sources" element={<DataSources />} />
            <Route path="/rules" element={<PlanningRules />} />
            <Route path="/reports" element={<Reports />} />

            {/* ── Backward Compatibility Redirects ── */}
            <Route path="/maintenance/*" element={<Navigate to="/maintenance" replace />} />
            <Route path="/corridor" element={<Navigate to="/corridor-data" replace />} />
            <Route path="/planning/workbench" element={<Navigate to="/planning/proposed" replace />} />
            <Route path="/planning/weekly" element={<Navigate to="/planning/proposed" replace />} />
            <Route path="/planning/monthly" element={<Navigate to="/planning/proposed" replace />} />
            <Route path="/planning/gantt" element={<Navigate to="/planning/proposed" replace />} />
            <Route path="/planning/replan" element={<Navigate to="/operations/replan" replace />} />
            <Route path="/conflicts" element={<Navigate to="/operations/conflicts" replace />} />
            <Route path="/approvals" element={<Navigate to="/operations/approved" replace />} />

            {/* ── Fallback ── */}
            <Route path="*" element={<StubPage title="Page Not Found" />} />
          </Routes>
        </AppShell>
      </PlanningProvider>
    </BrowserRouter>
  );
}
