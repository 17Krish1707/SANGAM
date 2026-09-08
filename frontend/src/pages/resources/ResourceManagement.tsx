import React, { useState, useEffect } from 'react';
import TopBar from '../../components/TopBar';
import { PageGuideBanner } from '../../components/ui/PageGuideBanner';
import {
  getResources,
  createResource,
  deleteResource,
  toggleResourceAvailability,
  type ResourceItem,
} from '../../lib/apiClient';
import {
  CheckSquare,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Users,
  Wrench,
  Zap,
  X,
  Info,
} from 'lucide-react';

export default function ResourceManagement() {
  const [resources, setResources] = useState<ResourceItem[]>([]);

  // Filters
  const [deptFilter, setDeptFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');

  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newResource, setNewResource] = useState({
    name: '',
    department_code: 'ENG',
    resource_type: 'Crew',
  });

  const [unavailModalOpen, setUnavailModalOpen] = useState(false);
  const [targetResource, setTargetResource] = useState<ResourceItem | null>(null);
  const [unavailData, setUnavailData] = useState({
    reason: 'Mechanical breakdown / under inspection',
    from: new Date().toISOString().slice(0, 16),
    until: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
  });

  const loadResources = async () => {
    try {
      const data = await getResources();
      setResources(data);
    } catch (err) {
      console.error('Failed loading resources:', err);
    }
  };

  useEffect(() => {
    loadResources();
  }, []);

  const handleAddResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newResource.name.trim()) return;
    try {
      await createResource({
        name: newResource.name.trim(),
        department_code: newResource.department_code,
        resource_type: newResource.resource_type,
        is_available: true,
      });
      setAddModalOpen(false);
      setNewResource({ name: '', department_code: 'ENG', resource_type: 'Crew' });
      await loadResources();
    } catch (err: any) {
      alert(`Failed creating resource: ${err.message || err}`);
    }
  };

  const handleToggleClick = (r: ResourceItem) => {
    if (r.is_available) {
      setTargetResource(r);
      setUnavailData({
        reason: 'Mechanical breakdown / under inspection',
        from: new Date().toISOString().slice(0, 16),
        until: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
      });
      setUnavailModalOpen(true);
    } else {
      toggleResourceAvailability(r.id, true)
        .then(() => loadResources())
        .catch((err) => alert(`Failed restoring resource: ${err.message || err}`));
    }
  };

  const handleConfirmUnavail = async () => {
    if (!targetResource) return;
    try {
      await toggleResourceAvailability(
        targetResource.id,
        false,
        unavailData.reason,
        new Date(unavailData.from).toISOString(),
        new Date(unavailData.until).toISOString()
      );
      setUnavailModalOpen(false);
      setTargetResource(null);
      await loadResources();
    } catch (err: any) {
      alert(`Failed marking unavailable: ${err.message || err}`);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete resource "${name}"? This removes it from future block planning.`)) return;
    try {
      await deleteResource(id);
      await loadResources();
    } catch (err: any) {
      alert(`Failed deleting resource: ${err.message || err}`);
    }
  };

  // Filtered
  const filtered = resources.filter((r) => {
    if (deptFilter && r.department_code !== deptFilter) return false;
    if (typeFilter && !r.resource_type.toLowerCase().includes(typeFilter.toLowerCase())) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!r.name.toLowerCase().includes(q) && !r.resource_type.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const availableCount = resources.filter((r) => r.is_available).length;
  const unavailableCount = resources.length - availableCount;

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#F6F8FB] text-[#172033]">
      <TopBar title="Resources & Machinery" subtitle="Department Work Gangs, Track Machines, and Tower Wagons" />

      <main className="p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Page Guide */}
        <PageGuideBanner
          pageTitle="Resources & Machinery"
          purpose="Register and manage operational crews and track machinery across Engineering, TRD, and S&T. SANGAM matches required resources to maintenance tasks. Marking a resource unavailable prevents the optimizer from scheduling work that requires it, or triggers an operational re-plan if already scheduled."
          inputs={['Resource Identifier & Name', 'Department (ENG, TRD, S&T)', 'Resource Classification (Crew / Equipment / Machine)', 'Availability Status & Outage Period']}
          outputs={['Active Machinery & Gang Pool', 'Resource Utilization & Task Assignments', 'Downtime Tracking']}
          nextStep={{ label: 'Proceed to Maintenance Work Demands', to: '/maintenance' }}
        />

        {/* Operational Context Card */}
        <div className="p-4 bg-white rounded-lg border border-[#D9E1EA] shadow-xs flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-50 text-[#173F7A] flex items-center justify-center flex-shrink-0 mt-0.5">
              <Info className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-[#172033] uppercase tracking-wider font-mono">
                Resource Constraint Rules
              </h3>
              <p className="text-xs text-[#667085] mt-1 leading-relaxed max-w-3xl">
                SANGAM assigns required heavy machines (Tower Wagons, Tamping Machines) and specialized departmental crews to approved block windows. Marking a resource unavailable prevents conflicting plans and prompts immediate re-allocation during block generation.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="bg-[#F8FAFC] border border-[#D9E1EA] px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-[#667085]">Available: <strong className="text-[#172033]">{availableCount}</strong></span>
            </div>
            <div className="bg-[#F8FAFC] border border-[#D9E1EA] px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span className="text-[#667085]">Unavailable: <strong className="text-[#172033]">{unavailableCount}</strong></span>
            </div>
          </div>
        </div>

        {/* Filter & Action Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-[#D9E1EA] shadow-xs">
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <input
              type="text"
              placeholder="Search resource name or type..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-[#F8FAFC] border border-[#D9E1EA] rounded px-3 py-1.5 text-xs text-[#172033] placeholder-slate-400 focus:outline-none focus:border-[#173F7A]"
            />
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="bg-[#F8FAFC] border border-[#D9E1EA] rounded px-3 py-1.5 text-xs text-[#172033] focus:outline-none focus:border-[#173F7A]"
            >
              <option value="">All Departments</option>
              <option value="ENG">Engineering (ENG)</option>
              <option value="SNT">Signalling (S&T)</option>
              <option value="TRD">Traction Distribution (TRD)</option>
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-[#F8FAFC] border border-[#D9E1EA] rounded px-3 py-1.5 text-xs text-[#172033] focus:outline-none focus:border-[#173F7A]"
            >
              <option value="">All Resource Types</option>
              <option value="Crew">Crews / Gangs</option>
              <option value="Tower Wagon">Tower Wagons</option>
              <option value="Machine">Machines / Tampers</option>
              <option value="Equipment">Equipment</option>
            </select>
          </div>

          <button
            onClick={() => setAddModalOpen(true)}
            className="w-full md:w-auto px-4 py-2 bg-[#173F7A] hover:bg-[#1E4E8C] text-white rounded-md font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            title="Register a new crew or heavy track machine"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Resource</span>
          </button>
        </div>

        {/* Resources Table */}
        {resources.length > 0 ? (
          <div className="bg-white border border-[#D9E1EA] rounded-lg shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] text-[#667085] font-mono text-[11px] uppercase tracking-wider border-b border-[#D9E1EA]">
                  <tr>
                    <th className="px-4 py-3">Resource Name</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Type / Class</th>
                    <th className="px-4 py-3">Operational Status</th>
                    <th className="px-4 py-3">Active Assignments</th>
                    <th className="px-4 py-3">Downtime / Reason</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D9E1EA]">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-[#667085]">
                        No matching resources found for current filters.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((r) => {
                      const isCrew = r.resource_type.toLowerCase().includes('crew') || r.resource_type.toLowerCase().includes('gang');
                      return (
                        <tr
                          key={r.id}
                          className={`hover:bg-slate-50 transition-colors ${
                            !r.is_available ? 'bg-amber-50/40' : ''
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {isCrew ? (
                                <Users className="w-4 h-4 text-[#173F7A] flex-shrink-0" />
                              ) : r.resource_type.toLowerCase().includes('tower') ? (
                                <Zap className="w-4 h-4 text-amber-600 flex-shrink-0" />
                              ) : (
                                <Wrench className="w-4 h-4 text-[#667085] flex-shrink-0" />
                              )}
                              <span className="font-bold text-[#172033]">{r.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#EBF2FA] text-[#173F7A]">
                              {r.department_code || 'GEN'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[#667085] font-medium">
                            {r.resource_type}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                r.is_available
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {r.is_available ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>Available</span>
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-3 h-3 text-amber-600" />
                                  <span>Unavailable</span>
                                </>
                              )}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-[#667085]">
                            {r.assigned_tasks_count > 0 ? (
                              <span className="text-[#173F7A] font-bold font-mono">
                                {r.assigned_tasks_count} tasks ({r.assigned_task_codes?.join(', ')})
                              </span>
                            ) : (
                              'Standby / Unallocated'
                            )}
                          </td>
                          <td className="px-4 py-3 text-[#667085]">
                            {r.is_available ? (
                              '—'
                            ) : (
                              <span className="text-amber-800 font-medium">
                                {r.unavailability_reason || 'Marked unavailable'}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleToggleClick(r)}
                                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                                  r.is_available
                                    ? 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                                    : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                                }`}
                                title={
                                  r.is_available
                                    ? 'Prevents this resource from being assigned during the unavailable period.'
                                    : 'Restores resource to active pool for block scheduling.'
                                }
                              >
                                {r.is_available ? 'Mark Unavailable' : 'Restore'}
                              </button>
                              <button
                                onClick={() => handleDelete(r.id, r.name)}
                                className="p-1 hover:bg-red-50 text-red-600 rounded transition-colors"
                                title="Delete this resource"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-[#D9E1EA] p-10 text-center shadow-xs">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-[#173F7A] flex items-center justify-center mx-auto mb-3">
              <CheckSquare className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-[#172033]">No operational resources registered</h3>
            <p className="text-xs text-[#667085] max-w-md mx-auto mt-1 leading-relaxed">
              Register crews and machines (e.g. <em>ENG Crew 1</em>, <em>TRD Crew 1</em>, <em>S&T Crew 1</em>, and <em>Tower Wagon 1</em>) so maintenance jobs can be assigned to possessions.
            </p>
            <button
              onClick={() => setAddModalOpen(true)}
              className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#173F7A] text-white text-xs font-bold hover:bg-[#1E4E8C] transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Add First Resource</span>
            </button>
          </div>
        )}
      </main>

      {/* ── MODAL: ADD RESOURCE ── */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-[#D9E1EA] rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#D9E1EA] pb-3">
              <h2 className="text-base font-bold text-[#172033] flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#173F7A]" />
                Add Railway Resource
              </h2>
              <button onClick={() => setAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddResource} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#172033] mb-1">Resource Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ENG Crew 1, Tower Wagon 1, S&T Crew 1"
                  value={newResource.name}
                  onChange={(e) => setNewResource({ ...newResource, name: e.target.value })}
                  className="w-full bg-[#F8FAFC] border border-[#D9E1EA] rounded p-2 text-[#172033] focus:outline-none focus:border-[#173F7A]"
                />
                <span className="text-[10px] text-[#667085] mt-0.5 block">Unique name of work gang or heavy machinery</span>
              </div>

              <div>
                <label className="block font-semibold text-[#172033] mb-1">Department *</label>
                <select
                  value={newResource.department_code}
                  onChange={(e) => setNewResource({ ...newResource, department_code: e.target.value })}
                  className="w-full bg-[#F8FAFC] border border-[#D9E1EA] rounded p-2 text-[#172033] focus:outline-none focus:border-[#173F7A]"
                >
                  <option value="ENG">Engineering (P-Way / Track)</option>
                  <option value="TRD">Traction Distribution (TRD / OHE)</option>
                  <option value="SNT">Signalling & Telecom (S&T)</option>
                </select>
                <span className="text-[10px] text-[#667085] mt-0.5 block">Department that operates this resource</span>
              </div>

              <div>
                <label className="block font-semibold text-[#172033] mb-1">Resource Type / Class *</label>
                <select
                  value={newResource.resource_type}
                  onChange={(e) => setNewResource({ ...newResource, resource_type: e.target.value })}
                  className="w-full bg-[#F8FAFC] border border-[#D9E1EA] rounded p-2 text-[#172033] focus:outline-none focus:border-[#173F7A]"
                >
                  <option value="Crew">Crew / Maintenance Gang</option>
                  <option value="Equipment">Specialized Equipment</option>
                  <option value="Tower Wagon">Tower Wagon (OHE Inspection)</option>
                  <option value="Tamping Machine">Tamping Machine (CSM/TTM)</option>
                  <option value="Dynamic Track Stabilizer">Track Stabilizer (DTS)</option>
                  <option value="Ballast Regulating Machine">Ballast Regulator (BRM)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#D9E1EA]">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#173F7A] hover:bg-[#1E4E8C] text-white rounded font-bold text-xs shadow-xs"
                >
                  Save Resource
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: MARK RESOURCE UNAVAILABLE ── */}
      {unavailModalOpen && targetResource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-[#D9E1EA] rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#D9E1EA] pb-3">
              <h2 className="text-base font-bold text-[#172033] flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Report Resource Downtime / Diverted
              </h2>
              <button onClick={() => setUnavailModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#667085] leading-relaxed">
              Taking <strong className="text-[#172033]">{targetResource.name}</strong> out of active availability will prevent future block plans from assigning it, and highlights affected blocks in the Re-planning view.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#172033] mb-1">Reason for Unavailability *</label>
                <select
                  value={unavailData.reason}
                  onChange={(e) => setUnavailData({ ...unavailData, reason: e.target.value })}
                  className="w-full bg-[#F8FAFC] border border-[#D9E1EA] rounded p-2 text-[#172033] focus:outline-none focus:border-[#173F7A] text-xs mb-2"
                >
                  <option value="Mechanical breakdown / hydraulic failure">Mechanical breakdown / hydraulic failure</option>
                  <option value="Crew diverted to emergency derailment / restoration">Crew diverted to emergency restoration</option>
                  <option value="Scheduled depot overhaul / IOH inspection">Scheduled depot overhaul / IOH inspection</option>
                  <option value="Tamping unit calibration & sensor maintenance">Calibration / Sensor maintenance</option>
                </select>
                <input
                  type="text"
                  value={unavailData.reason}
                  onChange={(e) => setUnavailData({ ...unavailData, reason: e.target.value })}
                  placeholder="Or enter custom reason..."
                  className="w-full bg-[#F8FAFC] border border-[#D9E1EA] rounded p-2 text-[#172033] focus:outline-none focus:border-[#173F7A] text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#172033] mb-1">Down From *</label>
                  <input
                    type="datetime-local"
                    value={unavailData.from}
                    onChange={(e) => setUnavailData({ ...unavailData, from: e.target.value })}
                    className="w-full bg-[#F8FAFC] border border-[#D9E1EA] rounded p-2 text-[#172033] focus:outline-none focus:border-[#173F7A] font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#172033] mb-1">Expected Ready *</label>
                  <input
                    type="datetime-local"
                    value={unavailData.until}
                    onChange={(e) => setUnavailData({ ...unavailData, until: e.target.value })}
                    className="w-full bg-[#F8FAFC] border border-[#D9E1EA] rounded p-2 text-[#172033] focus:outline-none focus:border-[#173F7A] font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#D9E1EA]">
              <button
                onClick={() => setUnavailModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmUnavail}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold text-xs shadow-xs"
              >
                Confirm Unavailable
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
