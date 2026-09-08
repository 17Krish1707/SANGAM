import { useState, useEffect } from 'react';
import { X, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react';
import {
  createTask,
  updateTask,
  getResources,
  type MaintenanceTask,
  type ResourceItem,
} from '../../lib/apiClient';

interface SectionOption {
  id: string;
  name: string;
}

interface MaintenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  taskToEdit?: MaintenanceTask | null;
  sections: SectionOption[];
  isEmergency?: boolean;
}

export default function MaintenanceModal({
  isOpen,
  onClose,
  onSuccess,
  taskToEdit,
  sections,
  isEmergency = false,
}: MaintenanceModalProps) {
  const [departmentCode, setDepartmentCode] = useState('ENG');
  const [sectionId, setSectionId] = useState('');
  const [assetName, setAssetName] = useState('Turnout 101 / Track Segment');
  const [maintenanceType, setMaintenanceType] = useState('Weld Repair');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<'Low' | 'Medium' | 'High' | 'Critical'>('High');
  const [detectedAt, setDetectedAt] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [estimatedDurationMin, setEstimatedDurationMin] = useState(90);
  const [minContiguousMin, setMinContiguousMin] = useState(75);
  const [requiresPowerIsolation, setRequiresPowerIsolation] = useState(false);
  const [canRunParallel, setCanRunParallel] = useState(true);
  const [crewType, setCrewType] = useState('ENG Crew 1');
  const [equipment, setEquipment] = useState('');
  const [operationalNotes, setOperationalNotes] = useState('');

  // Resources list for selection
  const [availableResources, setAvailableResources] = useState<ResourceItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      getResources()
        .then((res) => setAvailableResources(res))
        .catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    if (taskToEdit) {
      setDepartmentCode(taskToEdit.department_code || 'ENG');
      setSectionId(taskToEdit.section_id || (sections[0]?.id ?? ''));
      setAssetName(taskToEdit.asset_name || 'Track Asset');
      setMaintenanceType(taskToEdit.maintenance_type || '');
      setDescription(taskToEdit.description || '');
      setSeverity(taskToEdit.severity || 'Medium');
      setDetectedAt(taskToEdit.detected_at ? taskToEdit.detected_at.slice(0, 16) : '');
      setDueDate(taskToEdit.due_date ? taskToEdit.due_date.slice(0, 16) : '');
      setEstimatedDurationMin(taskToEdit.estimated_duration_min || 90);
      setMinContiguousMin(taskToEdit.minimum_contiguous_block_min || 60);
      setRequiresPowerIsolation(Boolean(taskToEdit.requires_power_isolation));
      setCanRunParallel(Boolean(taskToEdit.can_run_parallel));
      setOperationalNotes(taskToEdit.operational_notes || '');
    } else {
      // Defaults for new task
      const now = new Date();
      const nextDue = new Date(now.getTime() + 4 * 24 * 3600 * 1000);
      setDepartmentCode('ENG');
      setSectionId(sections[0]?.id ?? '');
      setAssetName('Track Weld / Rail Segment');
      setMaintenanceType(isEmergency ? 'EMERGENCY: Rail Fracture Repair' : 'Weld Repair');
      setDescription('');
      setSeverity(isEmergency ? 'Critical' : 'High');
      setDetectedAt(now.toISOString().slice(0, 16));
      setDueDate(nextDue.toISOString().slice(0, 16));
      setEstimatedDurationMin(90);
      setMinContiguousMin(75);
      setRequiresPowerIsolation(false);
      setCanRunParallel(true);
      setCrewType('ENG Crew 1');
      setEquipment('');
      setOperationalNotes('');
    }
  }, [taskToEdit, sections, isEmergency, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (targetStatus: 'New' | 'Pending') => {
    setError(null);

    // Validation
    if (!maintenanceType.trim()) {
      setError('Maintenance type / work title is required.');
      return;
    }
    if (!sectionId) {
      setError('Please select a corridor section (or create one in Corridor Data).');
      return;
    }
    if (estimatedDurationMin <= 0) {
      setError('Estimated duration must be greater than 0 minutes.');
      return;
    }
    if (minContiguousMin > estimatedDurationMin) {
      setError('Minimum continuous block cannot exceed estimated duration.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (taskToEdit) {
        await updateTask(taskToEdit.id, {
          department_code: departmentCode,
          section_id: sectionId,
          asset_name: assetName,
          maintenance_type: maintenanceType,
          description,
          severity,
          detected_at: detectedAt ? new Date(detectedAt).toISOString() : undefined,
          due_date: new Date(dueDate).toISOString(),
          estimated_duration_min: Number(estimatedDurationMin),
          minimum_contiguous_block_min: Number(minContiguousMin),
          requires_power_isolation: requiresPowerIsolation,
          can_run_parallel: canRunParallel,
          operational_notes: operationalNotes,
          status: targetStatus,
        });
      } else {
        await createTask({
          department_code: departmentCode,
          section_id: sectionId,
          asset_name: assetName,
          maintenance_type: maintenanceType,
          description,
          severity,
          detected_at: detectedAt ? new Date(detectedAt).toISOString() : new Date().toISOString(),
          due_date: new Date(dueDate).toISOString(),
          estimated_duration_min: Number(estimatedDurationMin),
          minimum_contiguous_block_min: Number(minContiguousMin),
          requires_power_isolation: requiresPowerIsolation,
          can_run_parallel: canRunParallel,
          crew_type: crewType,
          equipment,
          operational_notes: operationalNotes,
          status: targetStatus,
          source: 'Manual',
        });
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save maintenance work.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white border border-[#D9E1EA] rounded-xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-[#D9E1EA] flex items-center justify-between bg-[#F8FAFC]">
          <div>
            <h2 className="text-base font-bold text-[#172033] flex items-center gap-2">
              <span>{taskToEdit ? 'Edit Maintenance Task' : isEmergency ? 'Log Emergency Defect' : 'Add Maintenance Work'}</span>
            </h2>
            <p className="text-[11px] text-[#667085] mt-0.5">
              Defines demand requirements for railway possessions. Priority is computed automatically upon saving.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-200 text-[#667085] hover:text-[#172033]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded bg-red-50 border border-red-200 text-red-700 flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Department & Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-[#172033] mb-1">Department *</label>
              <select
                value={departmentCode}
                onChange={(e) => {
                  setDepartmentCode(e.target.value);
                  if (e.target.value === 'TRD') setRequiresPowerIsolation(true);
                  if (e.target.value === 'ENG') setRequiresPowerIsolation(false);
                }}
                className="w-full p-2 border border-[#D9E1EA] rounded bg-[#F8FAFC] font-medium text-[#172033] focus:outline-none focus:border-[#173F7A]"
              >
                <option value="ENG">Civil Engineering (ENG) - P-Way / Track</option>
                <option value="TRD">Traction Distribution (TRD) - OHE 25kV</option>
                <option value="SNT">Signal & Telecom (S&T) - Interlocking / Points</option>
              </select>
              <span className="text-[10px] text-[#667085] mt-0.5 block">Which railway department requested this work?</span>
            </div>

            <div>
              <label className="block font-bold text-[#172033] mb-1">Corridor Section *</label>
              <select
                value={sectionId}
                onChange={(e) => setSectionId(e.target.value)}
                className="w-full p-2 border border-[#D9E1EA] rounded bg-[#F8FAFC] font-medium text-[#172033] focus:outline-none focus:border-[#173F7A]"
              >
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-[#667085] mt-0.5 block">Where must the work be performed?</span>
            </div>
          </div>

          {/* Asset & Maintenance Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-[#172033] mb-1">Asset Affected</label>
              <input
                type="text"
                value={assetName}
                onChange={(e) => setAssetName(e.target.value)}
                placeholder="e.g. Turnout 12B, OHE Mast KM 42/10"
                className="w-full p-2 border border-[#D9E1EA] rounded bg-[#F8FAFC] text-[#172033] focus:outline-none focus:border-[#173F7A]"
              />
              <span className="text-[10px] text-[#667085] mt-0.5 block">Specific track, OHE, or signalling component</span>
            </div>

            <div>
              <label className="block font-bold text-[#172033] mb-1">Maintenance Type / Title *</label>
              <input
                type="text"
                value={maintenanceType}
                onChange={(e) => setMaintenanceType(e.target.value)}
                placeholder="e.g. Weld Repair, Point Machine Inspection, OHE Inspection"
                className="w-full p-2 border border-[#D9E1EA] rounded bg-[#F8FAFC] text-[#172033] focus:outline-none focus:border-[#173F7A] font-bold"
              />
              <span className="text-[10px] text-[#667085] mt-0.5 block">Standard maintenance procedure title</span>
            </div>
          </div>

          {/* Severity & Due Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-[#172033] mb-1">Severity *</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as any)}
                className={`w-full p-2 border border-[#D9E1EA] rounded font-bold ${
                  severity === 'Critical' ? 'bg-red-50 text-red-700 border-red-300' : 'bg-[#F8FAFC] text-[#172033]'
                } focus:outline-none focus:border-[#173F7A]`}
              >
                <option value="Low">Low (Routine)</option>
                <option value="Medium">Medium (Scheduled cycle)</option>
                <option value="High">High (Safety priority)</option>
                <option value="Critical">Critical (Immediate possession)</option>
              </select>
              <span className="text-[10px] text-[#667085] mt-0.5 block">How urgent or safety-critical is the work?</span>
            </div>

            <div>
              <label className="block font-bold text-[#172033] mb-1">Due Date *</label>
              <input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full p-2 border border-[#D9E1EA] rounded bg-[#F8FAFC] text-[#172033] font-mono text-xs focus:outline-none focus:border-[#173F7A]"
              />
              <span className="text-[10px] text-[#667085] mt-0.5 block">Statutory safety compliance deadline</span>
            </div>
          </div>

          {/* Durations */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-[#172033] mb-1">
                Estimated Duration (Minutes) *
              </label>
              <input
                type="number"
                min={15}
                max={600}
                step={15}
                value={estimatedDurationMin}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setEstimatedDurationMin(val);
                  if (minContiguousMin > val) setMinContiguousMin(val);
                }}
                className="w-full p-2 border border-[#D9E1EA] rounded bg-[#F8FAFC] text-[#172033] font-mono focus:outline-none focus:border-[#173F7A]"
              />
              <span className="text-[10px] text-[#667085] mt-0.5 block">Expected time required to complete the activity.</span>
            </div>

            <div>
              <label className="block font-bold text-[#172033] mb-1">
                Minimum Continuous Block (Minutes) *
              </label>
              <input
                type="number"
                min={15}
                max={estimatedDurationMin}
                step={15}
                value={minContiguousMin}
                onChange={(e) => setMinContiguousMin(Number(e.target.value))}
                className="w-full p-2 border border-[#D9E1EA] rounded bg-[#F8FAFC] text-[#172033] font-mono focus:outline-none focus:border-[#173F7A]"
              />
              <span className="text-[10px] text-[#667085] mt-0.5 block">Minimum uninterrupted possession required.</span>
            </div>
          </div>

          {/* Operational Rules Checkboxes */}
          <div className="p-3.5 bg-[#F8FAFC] border border-[#D9E1EA] rounded-lg space-y-2.5">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={requiresPowerIsolation}
                onChange={(e) => setRequiresPowerIsolation(e.target.checked)}
                className="mt-0.5 rounded text-[#173F7A] focus:ring-[#173F7A]"
              />
              <div>
                <span className="font-semibold text-[#172033]">Requires Power Isolation (25kV OHE Cut)</span>
                <span className="text-[10px] text-[#667085] block">Enable if OHE electrical isolation is required.</span>
              </div>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={canRunParallel}
                onChange={(e) => setCanRunParallel(e.target.checked)}
                className="mt-0.5 rounded text-[#173F7A] focus:ring-[#173F7A]"
              />
              <div>
                <span className="font-semibold text-[#172033]">Can Run Parallel with Compatible Work</span>
                <span className="text-[10px] text-[#667085] block">Can this work safely happen while compatible work from another department is happening in the same possession?</span>
              </div>
            </label>
          </div>

          {/* Resources Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-[#172033] mb-1">Required Crew / Gang</label>
              {availableResources.filter((r) => r.resource_type === 'Crew').length > 0 ? (
                <select
                  value={crewType}
                  onChange={(e) => setCrewType(e.target.value)}
                  className="w-full p-2 border border-[#D9E1EA] rounded bg-[#F8FAFC] text-[#172033] focus:outline-none focus:border-[#173F7A]"
                >
                  <option value="">None / External</option>
                  {availableResources
                    .filter((r) => r.resource_type === 'Crew')
                    .map((r) => (
                      <option key={r.id} value={r.name}>
                        {r.name} ({r.department_code})
                      </option>
                    ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={crewType}
                  onChange={(e) => setCrewType(e.target.value)}
                  placeholder="e.g. ENG Crew 1, S&T Crew 1"
                  className="w-full p-2 border border-[#D9E1EA] rounded bg-[#F8FAFC] text-[#172033]"
                />
              )}
              <span className="text-[10px] text-[#667085] mt-0.5 block">Select the maintenance gang needed.</span>
            </div>

            <div>
              <label className="block font-bold text-[#172033] mb-1">Required Equipment / Machinery</label>
              {availableResources.filter((r) => r.resource_type !== 'Crew').length > 0 ? (
                <select
                  value={equipment}
                  onChange={(e) => setEquipment(e.target.value)}
                  className="w-full p-2 border border-[#D9E1EA] rounded bg-[#F8FAFC] text-[#172033] focus:outline-none focus:border-[#173F7A]"
                >
                  <option value="">None / Hand Tools</option>
                  {availableResources
                    .filter((r) => r.resource_type !== 'Crew')
                    .map((r) => (
                      <option key={r.id} value={r.name}>
                        {r.name} ({r.resource_type})
                      </option>
                    ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={equipment}
                  onChange={(e) => setEquipment(e.target.value)}
                  placeholder="e.g. Tower Wagon 1, Tamping Machine"
                  className="w-full p-2 border border-[#D9E1EA] rounded bg-[#F8FAFC] text-[#172033]"
                />
              )}
              <span className="text-[10px] text-[#667085] mt-0.5 block">Select track machine or tower wagon needed.</span>
            </div>
          </div>

          {/* Automatic Scoring Notice */}
          <div className="p-2.5 rounded bg-blue-50 border border-blue-200 flex items-center gap-2 text-xs text-[#173F7A]">
            <Sparkles className="w-4 h-4 flex-shrink-0" />
            <span>
              <strong>Priority Calculated Automatically:</strong> Based on severity, due date proximity, track speed, and corridor passenger density.
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[#D9E1EA] bg-[#F8FAFC] rounded-b-xl flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded border border-[#D9E1EA] bg-white text-[#667085] hover:text-[#172033] font-semibold text-xs cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSubmit('New')}
              className="px-4 py-2 rounded border border-[#D9E1EA] bg-white text-[#172033] font-bold text-xs hover:bg-slate-50 cursor-pointer disabled:opacity-50"
            >
              Save Draft
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSubmit('Pending')}
              className="px-5 py-2 rounded bg-[#173F7A] text-white font-bold text-xs hover:bg-[#1E4E8C] transition-colors cursor-pointer disabled:opacity-50 shadow-xs flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Saving & Scoring...' : 'Save & Mark Ready'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
