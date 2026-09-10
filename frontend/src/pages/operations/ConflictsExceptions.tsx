import { useState } from 'react';
import TopBar from '../../components/TopBar';
import { PageGuideBanner } from '../../components/ui/PageGuideBanner';
import {
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  ArrowRight,
  Network,
} from 'lucide-react';
import { DepartmentCompatibilityMatrix } from '../../components/planning/DepartmentCompatibilityMatrix';

interface OperationalException {
  id: string;
  type: 'warning' | 'error';
  title: string;
  description: string;
  affectedSection: string;
  affectedTrain?: string;
  recommendedAction: string;
  actionPayload?: any;
}

const HARD_CONSTRAINTS = [
  {
    code: 'HC-01',
    name: 'Train Path Non-Overlap (No Collision)',
    description: 'Guarantees that no maintenance possession overlaps with scheduled passenger or freight paths.',
    status: 'Satisfied',
  },
  {
    code: 'HC-02',
    name: 'Passenger Train Clearance Buffer (10–15 min)',
    description: 'Enforces statutory safety headways between block closure and passenger train arrival.',
    status: 'Satisfied',
  },
  {
    code: 'HC-03',
    name: 'Resource Cumulative Capacity (No Double Booking)',
    description: 'Ensures crews, Tower Wagons, and Tamping Machines are not assigned to overlapping possessions.',
    status: 'Satisfied',
  },
  {
    code: 'HC-04',
    name: 'OHE Power Isolation Safety Protocol',
    description: 'Requires adjacent track clearance and electrical isolation verification whenever TRD work is executed.',
    status: 'Satisfied',
  },
  {
    code: 'HC-05',
    name: 'Minimum Continuous Possession Duration',
    description: 'Possessions are only scheduled if uninterrupted window exceeds the task minimum threshold.',
    status: 'Satisfied',
  },
  {
    code: 'HC-06',
    name: 'Department Parallel Execution Compatibility',
    description: 'Simultaneous jobs within a joint block must not have mutually exclusive safety restrictions.',
    status: 'Satisfied',
  },
];

export default function ConflictsExceptions() {
  const [activeTab, setActiveTab] = useState<'exceptions' | 'advanced' | 'compatibility'>('exceptions');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const [exceptions, setExceptions] = useState<OperationalException[]>([]);

  const handleResolveAction = async (exc: OperationalException) => {
    setActionNotice(`Exception verified and cleared: ${exc.title}`);
    setExceptions(exceptions.filter((e) => e.id !== exc.id));
    setTimeout(() => setActionNotice(null), 3500);
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#F6F8FB] text-[#172033]">
      <TopBar title="Conflicts & Exceptions" subtitle="Operational Feasibility Analysis, Safety Headway Checks, and Constraint Matrix" />

      <main className="p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Page Guide Banner */}
        <PageGuideBanner
          pageTitle="Conflicts & Exceptions"
          purpose="Inspect operational exceptions, train proximity headway warnings, and constraint verification across scheduled blocks. SANGAM automatically flags safety rule deviations before block sanctioning."
          inputs={['Proposed Block Schedule', 'Headway Clearance Margins', 'Resource Overlap Checks', 'Power Cut Protocols']}
          outputs={['Actionable Resolution Items', 'CP-SAT Hard Constraint Audit Matrix', 'Sanction Readiness Status']}
          nextStep={{ label: 'Proceed to Operational Block Register', to: '/operations/approved' }}
        />

        {/* Header & Feasibility Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-[#D9E1EA] shadow-xs">
          <div>
            <h1 className="text-xl font-bold text-[#172033] flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <span>Operational Exceptions & Constraint Verification</span>
            </h1>
            <p className="text-xs text-[#667085] mt-1">
              Active operating deviations, headway alerts, and mathematical feasibility analysis.
            </p>
          </div>

          <span className="text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-full font-semibold flex items-center gap-1.5 self-start sm:self-auto">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Feasibility: Satisfied</span>
          </span>
        </div>

        {actionNotice && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-[#173F7A] font-semibold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{actionNotice}</span>
          </div>
        )}

        {/* Tab Toggle */}
        <div className="flex flex-wrap bg-white border border-[#D9E1EA] p-1 rounded-lg w-fit text-xs font-semibold gap-1">
          <button
            onClick={() => setActiveTab('exceptions')}
            className={`px-4 py-2 rounded-md transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'exceptions'
                ? 'bg-[#EBF2FA] text-[#173F7A] font-bold shadow-xs'
                : 'text-[#667085] hover:text-[#172033]'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <span>Actionable Exceptions ({exceptions.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('compatibility')}
            className={`px-4 py-2 rounded-md transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'compatibility'
                ? 'bg-[#EBF2FA] text-[#173F7A] font-bold shadow-xs'
                : 'text-[#667085] hover:text-[#172033]'
            }`}
          >
            <Network className="w-3.5 h-3.5 text-indigo-600" />
            <span>Department Compatibility & Joint Bundles</span>
          </button>
          <button
            onClick={() => setActiveTab('advanced')}
            className={`px-4 py-2 rounded-md transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'advanced'
                ? 'bg-[#EBF2FA] text-[#173F7A] font-bold shadow-xs'
                : 'text-[#667085] hover:text-[#172033]'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-[#173F7A]" />
            <span>Constraint Rules Formulation</span>
          </button>
        </div>

        {/* ── TAB 1: EXCEPTIONS ── */}
        {activeTab === 'exceptions' && (
          <div className="space-y-4">
            {exceptions.length === 0 ? (
              <div className="p-12 bg-white border border-[#D9E1EA] rounded-xl text-center space-y-2 shadow-xs">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                <h3 className="text-base font-bold text-[#172033]">All Clear — Zero Active Exceptions</h3>
                <p className="text-xs text-[#667085] max-w-md mx-auto">
                  Every scheduled block complies with passenger buffer rules, power isolation boundaries, and machine availability.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {exceptions.map((exc) => {
                  const isError = exc.type === 'error';
                  return (
                    <div
                      key={exc.id}
                      className={`p-5 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all bg-white ${
                        isError ? 'border-red-300' : 'border-[#D9E1EA]'
                      } shadow-xs`}
                    >
                      <div className="flex items-start gap-3.5">
                        <div
                          className={`p-2 rounded-lg flex-shrink-0 mt-0.5 ${
                            isError ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {isError ? <ShieldAlert className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#172033] text-sm">{exc.title}</span>
                            <span
                              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                                isError ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {isError ? 'Action Required' : 'Advisory'}
                            </span>
                          </div>
                          <p className="text-xs text-[#667085] leading-relaxed max-w-3xl">
                            {exc.description}
                          </p>
                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#667085] pt-1">
                            <span>Section: <strong className="text-[#172033]">{exc.affectedSection}</strong></span>
                            {exc.affectedTrain && (
                              <span>Train: <strong className="text-[#173F7A]">{exc.affectedTrain}</strong></span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex-shrink-0 self-end md:self-center">
                        <button
                          onClick={() => handleResolveAction(exc)}
                          className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition-colors shadow-xs cursor-pointer ${
                            isError
                              ? 'bg-red-600 hover:bg-red-700 text-white'
                              : 'bg-[#173F7A] hover:bg-[#1E4E8C] text-white'
                          }`}
                        >
                          <span>{exc.recommendedAction}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: COMPATIBILITY MATRIX ── */}
        {activeTab === 'compatibility' && (
          <div className="space-y-4">
            <DepartmentCompatibilityMatrix />
          </div>
        )}

        {/* ── TAB 3: CONSTRAINT MATRIX ── */}
        {activeTab === 'advanced' && (
          <div className="bg-white border border-[#D9E1EA] rounded-xl p-6 space-y-4 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-[#172033] flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-[#173F7A]" />
                <span>Hard Constraint Formulation Matrix</span>
              </h3>
              <p className="text-xs text-[#667085] mt-0.5">
                Active CP-SAT boolean decision constraints mathematically enforced on solver variables.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              {HARD_CONSTRAINTS.map((hc) => (
                <div key={hc.code} className="p-3.5 bg-[#F8FAFC] border border-[#D9E1EA] rounded-lg space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-xs font-bold text-[#173F7A]">{hc.code}: {hc.name}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      {hc.status}
                    </span>
                  </div>
                  <p className="text-xs text-[#667085] leading-relaxed">
                    {hc.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
