/**
 * SANGAM API Client
 * Typed fetch wrapper pointing at VITE_API_BASE_URL.
 * Stub functions are added here for endpoints used in later phases — they will be
 * filled in as pages are built rather than wired to real data now.
 */

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8000';

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
    ...options,
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body?.detail ?? detail;
    } catch {
      // ignore parse errors
    }
    throw new ApiError(res.status, detail);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

// ─────────────────────────────────────────────
// Health
// ─────────────────────────────────────────────

export interface HealthResponse {
  status: string;
  service: string;
}

export function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/health');
}

// ─────────────────────────────────────────────
// Sections
// ─────────────────────────────────────────────

export interface Section {
  id: string;
  name: string;
  code?: string;
  from_station: string;
  to_station: string;
  length_km?: number;
  tracks_count?: number;
  electrification_type?: string;
  line_type: string;
  corridor_name?: string;
  is_electrified?: boolean;
  traction_type?: string;
  section_capacity_notes: string | null;
}

export interface SectionCreateInput {
  name: string;
  corridor_name?: string;
  from_station: string;
  to_station: string;
  length_km?: number;
  line_type?: 'single' | 'double';
  is_electrified?: boolean;
  traction_type?: string;
  section_capacity_notes?: string;
}

export function getSections(): Promise<Section[]> {
  return request<Section[]>('/api/sections');
}

export function createSection(data: SectionCreateInput): Promise<Section> {
  return request<Section>('/api/sections', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateSection(id: string, data: Partial<SectionCreateInput>): Promise<Section> {
  return request<Section>(`/api/sections/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteSection(id: string): Promise<void> {
  return request<void>(`/api/sections/${id}`, {
    method: 'DELETE',
  });
}

export interface CorridorSetupInput {
  corridor_name: string;
  stations: string[];
  line_type?: string;
  is_electrified?: boolean;
}

export function setupCorridor(data: CorridorSetupInput): Promise<{ message: string; sections: Section[] }> {
  return request<{ message: string; sections: Section[] }>('/api/sections/corridor-setup', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export interface CorridorInfrastructureEntity {
  id: string;
  section_id: string;
  section_name: string;
  asset_type: string;
  track_line: string;
  start_ref: string;
  end_ref: string;
  chainage_start_km: number | null;
  chainage_end_km: number | null;
  health_state: string;
  notes: string | null;
}

export interface CorridorInfrastructureData {
  corridor_name: string;
  from_station: string;
  to_station: string;
  total_length_km: number;
  configured_lines: string[];
  sections: Section[];
  departments: {
    engineering: {
      name: string;
      reference_unit: string;
      entities: CorridorInfrastructureEntity[];
      count: number;
    };
    signalling: {
      name: string;
      reference_unit: string;
      entities: CorridorInfrastructureEntity[];
      count: number;
    };
    traction: {
      name: string;
      reference_unit: string;
      entities: CorridorInfrastructureEntity[];
      count: number;
    };
  };
}

export function getCorridorInfrastructure(fromStation?: string, toStation?: string): Promise<CorridorInfrastructureData> {
  const qs = new URLSearchParams();
  if (fromStation) qs.set('from_station', fromStation);
  if (toStation) qs.set('to_station', toStation);
  const qStr = qs.toString();
  return request<CorridorInfrastructureData>(`/api/sections/corridor/infrastructure${qStr ? `?${qStr}` : ''}`);
}

export interface CoordinationPair {
  task_a: {
    id: string;
    code: string;
    dept: string;
    type: string;
    location: string;
    track: string;
    requires_power: boolean;
  };
  task_b: {
    id: string;
    code: string;
    dept: string;
    type: string;
    location: string;
    track: string;
    requires_power: boolean;
  };
  spatial_overlap: string;
  overlap_km: number;
  track_relation: string;
  protection_check: string;
  requires_power_cut: boolean;
  result: string;
  result_color: string;
  reason: string;
  is_cross_department: boolean;
}

export interface CorridorCoordinationResponse {
  total_tasks_evaluated: number;
  total_coordination_pairs: number;
  candidate_joint_pairs: number;
  pairs: CoordinationPair[];
}

export function getCorridorCoordinationAnalysis(sectionIds?: string[]): Promise<CorridorCoordinationResponse> {
  const qs = sectionIds && sectionIds.length > 0 ? `?section_ids=${sectionIds.join(',')}` : '';
  return request<CorridorCoordinationResponse>(`/api/sections/corridor/coordination-analysis${qs}`);
}


// ─────────────────────────────────────────────
// Maintenance Tasks
// ─────────────────────────────────────────────

export interface MaintenanceTask {
  id: string;
  task_code: string;
  title?: string;
  department_id: string;
  department_code: string | null;
  department_name: string | null;
  section_id: string;
  section_name: string | null;
  asset_id: string | null;
  asset_name: string | null;
  maintenance_type: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  detected_at: string | null;
  due_date: string | null;
  estimated_duration_min: number;
  minimum_contiguous_block_min: number;
  requires_power_isolation: boolean;
  can_run_parallel: boolean;
  status: string;
  priority_score: number;
  description?: string | null;
  operational_notes?: string | null;
  track_line?: string | null;
  chainage_from_km?: number | null;
  chainage_to_km?: number | null;
  location_type?: string | null;
  start_entity_id?: string | null;
  end_entity_id?: string | null;
  location_display?: string | null;
  block_type_required?: string | null;
  requires_traffic_block?: boolean;
  requires_signal_disconnection?: boolean;
  is_joint_block_eligible?: boolean;
  source?: string;
  deferred_reason?: string | null;
  deferred_until?: string | null;
  completed_at?: string | null;
  department?: string;
  priority?: string;
  created_at: string | null;
}

export interface TaskFilters {
  department?: string;
  severity?: string;
  min_priority?: number;
  overdue_only?: boolean;
  section_id?: string;
  status?: string;
}

export function getTasks(filters: TaskFilters = {}): Promise<MaintenanceTask[]> {
  const params = new URLSearchParams();
  if (filters.department)  params.set('department',  filters.department);
  if (filters.severity)    params.set('severity',    filters.severity);
  if (filters.min_priority !== undefined) params.set('min_priority', String(filters.min_priority));
  if (filters.overdue_only) params.set('overdue_only', 'true');
  if (filters.section_id)  params.set('section_id',  filters.section_id);
  const qs = params.toString();
  return request<MaintenanceTask[]>(`/api/tasks${qs ? `?${qs}` : ''}`);
}

export interface PriorityFactor {
  factor: string;
  contribution: number;
  detail: string;
}

export interface PriorityBreakdown {
  task_id: string;
  task_code: string;
  score: number;
  reasons: PriorityFactor[];
}

export function getTaskPriorityBreakdown(taskId: string): Promise<PriorityBreakdown> {
  return request<PriorityBreakdown>(`/api/tasks/${taskId}/priority-breakdown`);
}

// ─────────────────────────────────────────────
// Plans / Optimization
// ─────────────────────────────────────────────

export interface PlanGenerateRequest {
  section_ids?: string[];
  task_ids?: string[];
  start_date?: string;
  end_date?: string;
  horizon?: 'weekly' | 'monthly';
  run_types?: string[];
  objective_profile?: 'balanced' | 'max_availability' | 'min_train_impact';
}

export interface RunSummary {
  run_id: string;
  run_type: string;
  status: string;
  objective_value?: number;
  objective_profile?: string;
  solver_runtime_ms?: number;
  total_block_minutes?: number;
  tasks_scheduled?: number;
  tasks_unscheduled?: number;
}

export interface GenerateResponse {
  status: string;
  horizon: string;
  objective_profile?: string;
  runs: RunSummary[];
}

export function generatePlans(req: PlanGenerateRequest): Promise<GenerateResponse> {
  return request<GenerateResponse>('/api/plans/generate', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export interface BlockTask {
  id: string;
  task_code: string;
  department: string;
  department_name: string | null;
  maintenance_type: string;
  severity: string;
  duration_min: number;
  priority_score: number;
  requires_power_isolation: boolean;
  requires_signal_disconnection?: boolean;
  crew_type?: string;
  task_start?: string;
  task_end?: string;
  chainage_from_km?: number | null;
  chainage_to_km?: number | null;
  track_line?: string | null;
  location_type?: string | null;
  start_entity_id?: string | null;
  end_entity_id?: string | null;
  location_display?: string | null;
}

export interface GeneratedBlock {
  id: string;
  run_id: string;
  section_id: string;
  section_name?: string | null;
  corridor_name?: string | null;
  from_station?: string | null;
  to_station?: string | null;
  corridor_display?: string | null;
  spatial_coverage?: string | null;
  block_start: string;
  block_end: string;
  duration_min: number;
  is_joint_block: boolean;
  approval_status?: string;
  approval_note?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  locked?: boolean;
  tasks_count: number;
  tasks: BlockTask[];
  departments?: string[];
  operational_status?: 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled';
  execution_notes?: string | null;
  actual_start?: string | null;
  actual_end?: string | null;
  why_together?: string;
  train_impact?: any;
  track_line?: string;
  protection_types?: string[];
  date_fmt?: string;
  start_time_fmt?: string;
  end_time_fmt?: string;
}

export interface PlanAlternativeBlock {
  id: string;
  section_id: string;
  section_name: string;
  from_station: string;
  to_station: string;
  track_line: string;
  block_start: string;
  block_end: string;
  start_time_fmt: string;
  end_time_fmt: string;
  duration_min: number;
  is_joint_block: boolean;
  protection_summary: string;
  protections: string[];
  tasks: Array<{
    id: string;
    task_code: string;
    department: string;
    maintenance_type: string;
    track_line: string;
    duration_min: number;
    location_display: string;
  }>;
  tasks_count: number;
  approval_status?: string;
  train_impact?: any;
}

export interface PlanAlternative {
  plan_label: string;
  run_id: string;
  is_recommended: boolean;
  recommendation_explanation: string;
  tasks_scheduled: number;
  tasks_deferred: number;
  critical_tasks_ratio: string;
  priority_coverage_pct: number;
  track_closure_hours: number;
  total_block_minutes?: number;
  joint_blocks_count: number;
  trains_affected_count: number;
  nearby_trains_count: number;
  min_train_margin_min: number;
  expected_delay_min: number;
  train_impact_tier: 'zero' | 'amber' | 'red';
  train_impact_badge: string;
  solver_objective_value: number;
  blocks?: PlanAlternativeBlock[];
}

export interface PlanDetail {
  run_id: string;
  run_type: string;
  horizon: string;
  objective_profile?: string;
  solver_runtime_ms?: number | null;
  tasks_considered?: number | null;
  tasks_scheduled?: number | null;
  tasks_deferred?: number | null;
  status: string;
  objective_value: number | null;
  started_at: string | null;
  completed_at: string | null;
  total_blocks: number;
  blocks: GeneratedBlock[];
  train_impact?: any;
  alternatives?: PlanAlternative[];
}

export function getPlan(runId: string): Promise<PlanDetail> {
  return request<PlanDetail>(`/api/plans/${runId}`);
}

export function getPlanAlternatives(runId: string): Promise<{ alternatives: PlanAlternative[] }> {
  return request<{ alternatives: PlanAlternative[] }>(`/api/plans/${runId}/alternatives`);
}

export function approvePlan(runId: string, controllerName?: string, notes?: string): Promise<{ status: string; run_id: string; blocks_approved: number; tasks_scheduled: number }> {
  return request(`/api/plans/${runId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ controller_name: controllerName, notes }),
  });
}

export interface ApprovedBlockItem {
  id: string;
  block_code: string;
  run_id: string;
  section_id: string;
  section_name: string;
  from_station: string;
  to_station: string;
  track_line: string;
  block_start: string;
  block_end: string;
  duration_min: number;
  is_joint_block: boolean;
  protections: string[];
  protection_summary: string;
  approval_status: string;
  execution_status: string;
  approval_note?: string;
  approved_at?: string;
  approved_by?: string;
  tasks: Array<{
    id: string;
    task_code: string;
    department: string;
    maintenance_type: string;
    severity?: string;
    duration_min: number;
    location_display: string;
    track_line: string;
  }>;
  tasks_count: number;
  spatial_coverage: string;
  block_id?: string;
  start_time_fmt?: string;
  end_time_fmt?: string;
  date_fmt?: string;
  handover_notes?: string;
}

export function getAllApprovedBlocks(): Promise<ApprovedBlockItem[]> {
  return request<ApprovedBlockItem[]>('/api/plans/approved');
}

// ─────────────────────────────────────────────
// KPIs
// ─────────────────────────────────────────────

export interface KpiResult {
  run_id: string;
  run_type: string;
  total_block_hours: number;
  critical_task_coverage_pct: number;
  joint_block_utilization_pct: number;
  unscheduled_priority_sum: number;
  train_impact_score: number;
  resource_utilization_pct: number;
}

export function getPlanKpis(runId: string): Promise<KpiResult> {
  return request<KpiResult>(`/api/plans/${runId}/kpis`);
}

export interface AssetAvailability {
  asset_availability_pct: number;
  total_block_hours: number;
  total_corridor_hours: number;
  run_id: string | null;
}

export function getAssetAvailability(runId?: string): Promise<AssetAvailability> {
  const qs = runId ? `?run_id=${runId}` : '';
  return request<AssetAvailability>(`/api/kpis/asset-availability${qs}`);
}

export interface ComparePlanRow {
  run_id: string;
  run_type: string;
  status: string;
  total_block_hours: number;
  total_block_minutes: number;
  blocks_count: number;
  joint_blocks_count: number;
  critical_tasks_completed_pct: number;
  tasks_scheduled_count: number;
  tasks_unscheduled_count: number;
  unscheduled_priority_sum: number;
  train_impact_score: number;
}

export function comparePlans(runIds: string[]): Promise<ComparePlanRow[]> {
  return request<ComparePlanRow[]>(`/api/plans/compare?run_ids=${runIds.join(',')}`);
}

export interface DowntimeSaved {
  baseline_hours: number;
  optimized_hours: number;
  hours_saved: number;
  percent_saved: number;
}

export function compareDowntime(
  baselineRunId: string,
  optimizedRunId: string,
): Promise<DowntimeSaved> {
  return request<DowntimeSaved>(
    `/api/plans/compare-downtime?baseline_run_id=${baselineRunId}&optimized_run_id=${optimizedRunId}`,
  );
}

// ─────────────────────────────────────────────
// Explainability
// ─────────────────────────────────────────────

export interface TaskExplanation {
  task_id: string;
  task_code: string;
  scheduled: boolean;
  priority_score: number;
  reasons: string[];
  priority_breakdown: PriorityFactor[];
  window?: {
    block_start: string;
    block_end: string;
    section_name: string | null;
  };
}

export function getTaskExplanation(runId: string, taskId: string): Promise<TaskExplanation> {
  return request<TaskExplanation>(`/api/plans/${runId}/tasks/${taskId}/explanation`);
}

// ─────────────────────────────────────────────
// Corridor windows
// ─────────────────────────────────────────────

export interface CorridorWindow {
  id: string;
  section_id: string;
  window_start: string;
  window_end: string;
  duration_min: number;
  risk_score: number | null;
  is_available: boolean;
}

export function getCorridorWindows(
  sectionId: string,
  startDate: string,
  endDate: string,
): Promise<CorridorWindow[]> {
  return request<CorridorWindow[]>(
    `/api/corridor/${sectionId}/windows?start_date=${startDate}&end_date=${endDate}`,
  );
}

// ─────────────────────────────────────────────
// Latest runs (dashboard helper)
// ─────────────────────────────────────────────

export interface LatestRunInfo {
  run_id: string;
  run_type: string;
  horizon: string;
  started_at: string | null;
  completed_at: string | null;
  objective_value: number | null;
}

export interface LatestRunsResponse {
  sangam_optimized:     LatestRunInfo | null;
  independent_baseline: LatestRunInfo | null;
  greedy_baseline:      LatestRunInfo | null;
}

export function getLatestRuns(): Promise<LatestRunsResponse> {
  return request<LatestRunsResponse>('/api/plans/latest');
}

// ─────────────────────────────────────────────
// Conflicts
// ─────────────────────────────────────────────

export interface ConflictRow {
  id: string;
  task_a_id: string;
  task_a_code: string;
  task_a_section: string;
  task_a_dept: string;
  task_b_id: string;
  task_b_code: string;
  task_b_section: string;
  task_b_dept: string;
  relationship: string;
  notes: string | null;
}

export function getConflicts(relationship?: string): Promise<ConflictRow[]> {
  const qs = relationship ? `?relationship=${relationship}` : '';
  return request<ConflictRow[]>(`/api/conflicts${qs}`);
}

// ─────────────────────────────────────────────
// Replanning / What-If
// ─────────────────────────────────────────────

export interface DisruptionAssignment {
  task_id: string;
  task_code: string;
  new_window_start: string;
  new_window_end: string;
  changed: boolean;
}

export interface DisruptionResult {
  new_run_id: string;
  parent_run_id: string;
  new_run_status: string;
  delay_minutes: number;
  affected_blocks: {
    block_id: string;
    block_start: string;
    block_end: string;
    duration_min: number;
  }[];
  new_assignments: DisruptionAssignment[];
  unchanged_count: number;
  changed_count: number;
  disruption_summary: string;
}

export function simulateDisruption(
  runId: string,
  sectionId: string,
  delayMinutes: number,
): Promise<DisruptionResult> {
  return request<DisruptionResult>(`/api/plans/${runId}/simulate-disruption`, {
    method: 'POST',
    body: JSON.stringify({ section_id: sectionId, delay_minutes: delayMinutes }),
  });
}

export interface WhatIfDelta {
  [key: string]: number;
}

export interface WhatIfResult {
  change_applied: Record<string, unknown>;
  current_kpis:  KpiResult;
  scenario_kpis: KpiResult;
  deltas:        WhatIfDelta;
}

export function runWhatIf(
  runId: string,
  change: { type: string; window_id?: string; task_id?: string; new_severity?: string },
): Promise<WhatIfResult> {
  return request<WhatIfResult>(`/api/plans/${runId}/whatif`, {
    method: 'POST',
    body: JSON.stringify(change),
  });
}

// ─────────────────────────────────────────────
// Dashboard Summary & Intelligence
// ─────────────────────────────────────────────

export interface DashboardSummary {
  planning_horizon: string;
  division: string;
  latest_runs: {
    sangam_optimized: string | null;
    independent_baseline: string | null;
    greedy_baseline: string | null;
  };
  downtime_savings: DowntimeSaved | null;
  kpis: (KpiResult & { blocks_count?: number; joint_blocks_count?: number }) | null;
  demand: {
    total_tasks: number;
    pending_count: number;
    critical_count: number;
    overdue_count: number;
    by_department: Record<string, number>;
  };
  sections: Section[];
}

export function getDashboardSummary(): Promise<DashboardSummary> {
  return request<DashboardSummary>('/api/plans/dashboard/summary');
}

export interface TaskIntelligence {
  task: MaintenanceTask & {
    from_station: string | null;
    to_station: string | null;
  };
  priority_breakdown: {
    task_id: string;
    task_code: string;
    priority_score: number;
    explanation_text?: string;
    plain_english_explanation?: string;
    components: Record<string, { contribution: number; detail: string; weight?: number; label?: string }>;
  };
  relationships: {
    compatible: {
      task_id: string;
      task_code: string;
      department: string;
      type: string;
      severity: string;
      duration_min: number;
      notes?: string;
    }[];
    conflict: {
      task_id: string;
      task_code: string;
      department: string;
      type: string;
      severity: string;
      duration_min: number;
      notes?: string;
    }[];
    dependencies: {
      task_id: string;
      task_code: string;
      department: string;
      type: string;
      severity: string;
      duration_min: number;
      notes?: string;
    }[];
    compatible_count: number;
    conflict_count: number;
  };
  candidate_windows: {
    id: string;
    window_start: string;
    window_end: string;
    duration_min: number;
    fits_duration: boolean;
    risk_score: number | null;
    risk_level: 'Low' | 'Moderate' | 'High';
    risk_breakdown: {
      train_density: number;
      freight_uncertainty: number;
      peak_hour_penalty: number;
      delay_propagation_risk: number;
      total_risk: number;
      nearby_train_count: number;
    };
  }[];
  scheduled_assignment: {
    block_id: string;
    block_start: string;
    block_end: string;
    duration_min: number;
    is_joint_block: boolean;
    co_scheduled_tasks: {
      task_code: string;
      dept: string;
      type: string;
    }[];
  } | null;
}

export function getTaskIntelligence(taskId: string): Promise<TaskIntelligence> {
  return request<TaskIntelligence>(`/api/tasks/${taskId}/intelligence`);
}

// ─────────────────────────────────────────────
// Train Movements & 24h Occupancy
// ─────────────────────────────────────────────

export interface TrainMovementData {
  id: string;
  train_number?: string;
  train_type: 'Passenger' | 'Goods';
  entry_time: string;
  exit_time: string;
  scheduled_entry_time?: string;
  scheduled_exit_time?: string;
  delay_minutes?: number;
  visible_start: string;
  visible_end: string;
  transit_min: number;
  priority: number;
  forecast_confidence: number | null;
  buffer_before: string;
  buffer_after: string;
}

export interface SectionOccupancyData {
  section_id: string;
  section_name: string;
  date: string;
  day_start: string;
  day_end: string;
  total_available_minutes: number;
  passenger_train_count: number;
  goods_train_count: number;
  trains: TrainMovementData[];
  candidate_windows: {
    id: string;
    window_start: string;
    window_end: string;
    duration_min: number;
    risk_score: number | null;
    risk_breakdown: {
      train_density: number;
      freight_uncertainty: number;
      peak_hour_penalty: number;
      delay_propagation_risk: number;
      total_risk: number;
      nearby_train_count: number;
    };
  }[];
  scheduled_blocks: {
    id: string;
    block_start: string;
    block_end: string;
    duration_min: number;
    is_joint_block: boolean;
    approval_status?: string;
    tasks: {
      task_code: string;
      dept: string;
      type: string;
      severity: string;
    }[];
  }[];
}

export function getSectionOccupancy(sectionId: string, targetDate = new Date().toISOString().split('T')[0]): Promise<SectionOccupancyData> {
  return request<SectionOccupancyData>(`/api/corridor/${sectionId}/occupancy?target_date=${targetDate}`);
}

export function getSectionTrains(sectionId: string, startDate?: string, endDate?: string): Promise<TrainMovementData[]> {
  const p = new URLSearchParams();
  if (startDate) p.set('start_date', startDate);
  if (endDate) p.set('end_date', endDate);
  const qs = p.toString();
  return request<TrainMovementData[]>(`/api/corridor/${sectionId}/trains${qs ? `?${qs}` : ''}`);
}

// ─────────────────────────────────────────────
// Approvals
// ─────────────────────────────────────────────

export interface ApprovalItem {
  id: string;
  run_id: string;
  section_id: string;
  section_name: string | null;
  block_start: string;
  block_end: string;
  duration_min: number;
  is_joint_block: boolean;
  departments: string[];
  tasks_count: number;
  critical_tasks_count: number;
  approval_status: 'recommended' | 'approved' | 'modified' | 'rejected';
  approval_note?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  locked?: boolean;
  tasks: {
    task_code: string;
    dept: string;
    type: string;
    severity: string;
    priority: number;
  }[];
}

export function listApprovals(runId?: string): Promise<ApprovalItem[]> {
  const qs = runId ? `?run_id=${runId}` : '';
  return request<ApprovalItem[]>(`/api/plans/approvals/list${qs}`);
}

export function updateBlockApproval(
  blockId: string,
  payload: { action: string; controller_name?: string; notes?: string; locked?: boolean },
): Promise<{ status: string; block_id: string; approval_status: string; approved_by: string; approved_at: string; approval_note?: string; locked?: boolean }> {
  return request(`/api/plans/blocks/${blockId}/approval`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ─────────────────────────────────────────────
// Data Sources
// ─────────────────────────────────────────────

export interface DataSourcePipeline {
  name: string;
  system: string;
  department: string;
  adapter_status: string;
  source_format: string;
  records_ingested: number;
  sync_interval: string;
  latency_ms: number;
}

export interface DataSourcesSummary {
  status: string;
  prototype_seed: number;
  is_synthetic_prototype: boolean;
  disclosure: string;
  pipelines: DataSourcePipeline[];
  unified_model_totals: {
    total_maintenance_demand: number;
    corridor_sections: number;
    train_movements_considered: number;
  };
}

export function getDataSourcesSummary(): Promise<DataSourcesSummary> {
  return request<DataSourcesSummary>('/api/plans/data-sources/summary');
}

// ─────────────────────────────────────────────
// Task CRUD & Lifecycle API
// ─────────────────────────────────────────────

export interface TaskCreatePayload {
  department_code: string;
  section_id: string;
  asset_name?: string;
  maintenance_type: string;
  description?: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  detected_at?: string;
  due_date: string;
  estimated_duration_min: number;
  minimum_contiguous_block_min?: number;
  requires_power_isolation?: boolean;
  can_run_parallel?: boolean;
  crew_type?: string;
  equipment?: string;
  operational_notes?: string;
  status?: string;
  source?: string;
}

export function createTask(payload: TaskCreatePayload): Promise<{ status: string; id: string; task_code: string; priority_score: number; message: string }> {
  return request('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateTask(taskId: string, payload: Partial<TaskCreatePayload>): Promise<{ status: string; id: string; task_code: string; priority_score: number; message: string }> {
  return request(`/api/tasks/${taskId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function duplicateTask(taskId: string): Promise<{ status: string; new_task_id: string; new_task_code: string; message: string }> {
  return request(`/api/tasks/${taskId}/duplicate`, {
    method: 'POST',
  });
}

export function deferTask(taskId: string, reason: string, newTargetDate: string): Promise<{ status: string; task_id: string; task_code: string; status_now: string; deferred_until: string; reason: string }> {
  return request(`/api/tasks/${taskId}/defer`, {
    method: 'POST',
    body: JSON.stringify({ reason, new_target_date: newTargetDate }),
  });
}

export function completeTask(taskId: string, note?: string, completionTime?: string): Promise<{ status: string; task_id: string; task_code: string; status_now: string; completed_at: string }> {
  return request(`/api/tasks/${taskId}/complete`, {
    method: 'POST',
    body: JSON.stringify({ note, completion_time: completionTime }),
  });
}

export function deleteTask(taskId: string): Promise<{ status: string; message: string }> {
  return request(`/api/tasks/${taskId}`, {
    method: 'DELETE',
  });
}

export function createEmergencyTask(dept: string, sectionId: string, type: string, durationMin = 90): Promise<any> {
  const p = new URLSearchParams({
    department_code: dept,
    section_id: sectionId,
    maintenance_type: type,
    duration_min: String(durationMin),
  });
  return request(`/api/tasks/emergency?${p.toString()}`, {
    method: 'POST',
  });
}

export function importCsvTasks(tasks: any[]): Promise<{ status: string; imported_count: number; task_codes: string[]; message: string }> {
  return request('/api/tasks/import-csv', {
    method: 'POST',
    body: JSON.stringify({ tasks }),
  });
}

// ─────────────────────────────────────────────
// Train Timetable & Candidate Windows API
// ─────────────────────────────────────────────

export interface TimetableTrain {
  id: string;
  train_number: string;
  train_name?: string;
  direction?: string;
  section_id: string;
  section_name: string;
  train_type: 'Passenger' | 'Goods';
  entry_time: string;
  exit_time: string;
  scheduled_entry_time?: string;
  scheduled_exit_time?: string;
  delay_minutes?: number;
  transit_min: number;
  priority: number;
  forecast_confidence: number | null;
  source: string;
  notes?: string | null;
}

export function getAllTrains(sectionId?: string, trainType?: string): Promise<TimetableTrain[]> {
  const p = new URLSearchParams();
  if (sectionId) p.set('section_id', sectionId);
  if (trainType) p.set('train_type', trainType);
  const qs = p.toString();
  return request<TimetableTrain[]>(`/api/corridor/trains/all${qs ? `?${qs}` : ''}`);
}

export function createTrainMovement(payload: {
  train_number: string;
  train_type: string;
  section_id: string;
  entry_time: string;
  exit_time: string;
  priority?: number;
  forecast_confidence?: number;
  source?: string;
  notes?: string;
}): Promise<{ status: string; id: string; train_number: string; message: string }> {
  return request('/api/corridor/trains', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateTrainMovement(trainId: string, payload: any): Promise<any> {
  return request(`/api/corridor/trains/${trainId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function deleteTrainMovement(trainId: string): Promise<any> {
  return request(`/api/corridor/trains/${trainId}`, {
    method: 'DELETE',
  });
}

export interface CorridorWindowFull {
  id: string;
  section_id: string;
  section_name: string;
  window_start: string;
  window_end: string;
  duration_min: number;
  block_type: string;
  is_available: boolean;
  unavailability_reason?: string | null;
  source: string;
  risk_score: number | null;
  status: 'Available' | 'Unavailable';
}

export function getAllWindows(sectionId?: string): Promise<CorridorWindowFull[]> {
  const qs = sectionId ? `?section_id=${sectionId}` : '';
  return request<CorridorWindowFull[]>(`/api/corridor/windows/all${qs}`);
}

export function toggleWindowAvailability(windowId: string, isAvailable: boolean, reason?: string): Promise<any> {
  return request(`/api/corridor/windows/${windowId}/unavailability`, {
    method: 'POST',
    body: JSON.stringify({ is_available: isAvailable, reason }),
  });
}

// ─────────────────────────────────────────────
// Resources API
// ─────────────────────────────────────────────

export interface ResourceItem {
  id: string;
  name: string;
  department_id: string;
  department_code: string;
  department_name: string | null;
  resource_type: string;
  is_available: boolean;
  unavailability_reason?: string | null;
  unavailable_from?: string | null;
  unavailable_until?: string | null;
  assigned_tasks_count: number;
  assigned_task_codes: string[];
  status: 'Available' | 'Unavailable';
}

export function getResources(department?: string, resourceType?: string): Promise<ResourceItem[]> {
  const p = new URLSearchParams();
  if (department) p.set('department', department);
  if (resourceType) p.set('resource_type', resourceType);
  const qs = p.toString();
  return request<ResourceItem[]>(`/api/resources${qs ? `?${qs}` : ''}`);
}

export function createResource(payload: {
  name: string;
  department_code: string;
  resource_type: string;
  is_available?: boolean;
}): Promise<any> {
  return request('/api/resources', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateResource(resourceId: string, payload: any): Promise<any> {
  return request(`/api/resources/${resourceId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function toggleResourceAvailability(resourceId: string, isAvailable: boolean, reason?: string, from?: string, until?: string): Promise<any> {
  return request(`/api/resources/${resourceId}/toggle-availability`, {
    method: 'POST',
    body: JSON.stringify({ is_available: isAvailable, reason, unavailable_from: from, unavailable_until: until }),
  });
}

export function deleteResource(resourceId: string): Promise<any> {
  return request(`/api/resources/${resourceId}`, {
    method: 'DELETE',
  });
}

// ─────────────────────────────────────────────
// Planning Rules API
// ─────────────────────────────────────────────

export interface PlanningRulesResponse {
  status: string;
  hard_rules: Record<string, { value: any; unit?: string; description: string; is_hard_rule: boolean }>;
  planning_preferences: Record<string, { value: any; description: string }>;
  metadata: { last_updated: string; updated_by: string };
}

export function getPlanningRules(): Promise<PlanningRulesResponse> {
  return request<PlanningRulesResponse>('/api/rules');
}

export function updatePlanningRules(payload: any): Promise<any> {
  return request('/api/rules', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function resetPlanningRules(): Promise<any> {
  return request('/api/rules/reset', {
    method: 'POST',
  });
}

// ─────────────────────────────────────────────
// Block Overrides, Locking & Operational Changes
// ─────────────────────────────────────────────

export interface BlockValidationResult {
  is_valid: boolean;
  reason: string | null;
  message?: string;
  conflict_type?: string;
}

export function validateBlockChanges(blockId: string, newStart: string, newEnd: string, taskIds?: string[]): Promise<BlockValidationResult> {
  return request<BlockValidationResult>(`/api/plans/blocks/${blockId}/validate-changes`, {
    method: 'POST',
    body: JSON.stringify({ new_start: newStart, new_end: newEnd, task_ids: taskIds }),
  });
}

export function applyBlockOverride(blockId: string, newStart: string, newEnd: string, taskIds?: string[], note?: string): Promise<any> {
  return request(`/api/plans/blocks/${blockId}/override`, {
    method: 'PUT',
    body: JSON.stringify({ new_start: newStart, new_end: newEnd, task_ids: taskIds, note }),
  });
}

export function toggleBlockLock(blockId: string, locked: boolean): Promise<{ status: string; block_id: string; locked: boolean; message: string }> {
  return request(`/api/plans/blocks/${blockId}/lock`, {
    method: 'POST',
    body: JSON.stringify({ locked }),
  });
}

export function updateBlockExecutionStatus(blockId: string, status: 'approved' | 'in_progress' | 'completed' | 'cancelled', notes?: string, cancellationReason?: string): Promise<any> {
  return request(`/api/plans/blocks/${blockId}/execution-status`, {
    method: 'POST',
    body: JSON.stringify({ status, notes, cancellation_reason: cancellationReason }),
  });
}

export function approveBlock(blockId: string, note?: string): Promise<any> {
  return updateBlockExecutionStatus(blockId, 'approved', note);
}

export function rejectBlock(blockId: string, reason?: string): Promise<any> {
  return updateBlockExecutionStatus(blockId, 'cancelled', undefined, reason);
}

export function approveAllCleanBlocks(runId: string, controllerName?: string): Promise<{ status: string; approved_count: number; approved_by: string; message: string }> {
  return request('/api/plans/approvals/approve-all-clean', {
    method: 'POST',
    body: JSON.stringify({ run_id: runId, controller_name: controllerName }),
  });
}

export interface OperationalChangeDiff {
  status: string;
  change_type: string;
  new_run_id: string;
  parent_run_id: string;
  summary: {
    unchanged_count: number;
    moved_count: number;
    new_count: number;
    deferred_count: number;
  };
  unchanged_blocks?: any[];
  moved_blocks?: any[];
  new_blocks?: any[];
  disruption_summary: string;
}

export function reportOperationalChange(runId: string, payload: {
  change_type: 'train_delay' | 'window_unavailable' | 'resource_unavailable' | 'emergency_maintenance' | 'block_cancelled';
  section_id?: string;
  train_number?: string;
  delay_minutes?: number;
  window_id?: string;
  resource_id?: string;
  block_id?: string;
  description?: string;
}): Promise<OperationalChangeDiff> {
  return request<OperationalChangeDiff>(`/api/plans/${runId}/operational-change`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export type ReplanDiffResponse = OperationalChangeDiff;

export function simulateReplan(params: {
  parent_run_id: string;
  change_type: 'train_delay' | 'window_unavailable' | 'resource_unavailable' | 'emergency_maintenance' | 'block_cancelled';
  section_id?: string;
  train_number?: string;
  delay_minutes?: number;
  window_id?: string;
  resource_id?: string;
  block_id?: string;
  description?: string;
}): Promise<ReplanDiffResponse> {
  return reportOperationalChange(params.parent_run_id, params);
}

export const triggerOptimization = generatePlans;
export const updateBlockOperationalStatus = updateBlockExecutionStatus;

// ─────────────────────────────────────────────
// Dynamic Train Operations & Re-planning
// ─────────────────────────────────────────────

export interface DelayTrainResponse {
  status: string;
  id: string;
  train_number: string;
  section_id: string;
  scheduled_entry_time: string;
  scheduled_exit_time: string;
  entry_time: string;
  exit_time: string;
  delay_minutes: number;
  message: string;
}

export function delayTrain(trainId: string, delayMinutes: number, reason = 'Operational Delay'): Promise<DelayTrainResponse> {
  return request<DelayTrainResponse>(`/api/corridor/trains/${trainId}/delay`, {
    method: 'POST',
    body: JSON.stringify({ delay_minutes: delayMinutes, reason }),
  });
}

export function delayTrainByNumber(trainNumber: string, delayMinutes: number, reason = 'Operational Delay'): Promise<DelayTrainResponse> {
  return request<DelayTrainResponse>('/api/corridor/trains/delay-by-number', {
    method: 'POST',
    body: JSON.stringify({ train_number: trainNumber, delay_minutes: delayMinutes, reason }),
  });
}

export interface ReplanPreviewResponse {
  status: string;
  train_number: string;
  train_type: string;
  section_id: string;
  section_name: string;
  delay_minutes: number;
  original_path: {
    entry_time: string;
    exit_time: string;
  };
  preview_path: {
    entry_time: string;
    exit_time: string;
    buffer_start: string;
    buffer_end: string;
  };
  affected_blocks: {
    block_id: string;
    section_name: string;
    block_start: string;
    block_end: string;
    duration_min: number;
    is_joint_block: boolean;
    task_codes: string[];
    conflict_reason: string;
  }[];
  affected_count: number;
  total_plan_blocks: number;
  unaffected_count: number;
}

export function previewReplan(params: {
  run_id?: string;
  train_number?: string;
  section_id?: string;
  delay_minutes: number;
}): Promise<ReplanPreviewResponse> {
  return request<ReplanPreviewResponse>('/api/plans/replan/preview', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export interface PlanConflictItem {
  type: 'train_occupancy' | 'resource_unavailable';
  train_number?: string;
  train_type?: string;
  delay_minutes?: number;
  resource_name?: string;
  task_code?: string;
  block_id: string;
  section_id: string;
  section_name: string;
  block_start: string;
  block_end: string;
  description: string;
}

export interface PlanFreshnessResponse {
  status: 'CURRENT' | 'NEEDS_UPDATE' | 'HAS_CONFLICT' | 'NO_PLAN';
  run_id: string | null;
  has_conflicts: boolean;
  conflicts: PlanConflictItem[];
  affected_blocks_count: number;
  affected_block_ids: string[];
  reason: string;
}

export function getPlanFreshness(runId?: string): Promise<PlanFreshnessResponse> {
  const qs = runId ? `?run_id=${runId}` : '';
  return request<PlanFreshnessResponse>(`/api/plans/freshness${qs}`);
}

// ─────────────────────────────────────────────
// Department Compatibility & Joint Graph
// ─────────────────────────────────────────────

export interface CompatibilityNode {
  id: string;
  label: string;
  task_code: string;
  department: string;
  maintenance_type: string;
  severity: string;
  duration: number;
  priority_score: number;
  requires_power_isolation: boolean;
  can_run_parallel: boolean;
  due_date?: string;
  section_id?: string;
  section_name?: string;
}

export interface CompatibilityEdge {
  source: string;
  target: string;
  type: string;
  relationship: 'compatible' | 'conflict' | 'dependency';
  notes?: string;
  predecessor?: string;
  successor?: string;
  section_name?: string;
}

export interface JointCandidateCluster {
  section_id: string;
  section_name: string;
  task_ids: string[];
  tasks: Array<{
    id: string;
    code: string;
    title: string;
    dept: string;
    duration: number;
    power_cut: boolean;
  }>;
  departments: string[];
  is_cross_department: boolean;
  max_duration: number;
}

export interface DepartmentPolicy {
  dept_pair: string;
  name: string;
  compatibility: string;
  safety_protocol: string;
  status: string;
}

export interface CompatibilityMatrixResponse {
  nodes: CompatibilityNode[];
  edges: CompatibilityEdge[];
  joint_candidates: JointCandidateCluster[];
  department_matrix: DepartmentPolicy[];
  total_tasks: number;
  total_relationships: number;
  joint_candidate_clusters: number;
}

export function getCorridorCompatibilityMatrix(sectionId?: string): Promise<CompatibilityMatrixResponse> {
  const q = sectionId ? `?section_id=${sectionId}` : '';
  return request<CompatibilityMatrixResponse>(`/api/conflicts/compatibility-matrix${q}`);
}

export function resetOperationalDatabase(keepSections: boolean = false): Promise<{ status: string; message: string }> {
  return request<{ status: string; message: string }>(`/api/rules/reset-operational-data?keep_sections=${keepSections}`, {
    method: 'POST',
  });
}

export function initializeStandardDataset(): Promise<{ status: string; message: string; data?: any }> {
  return request<{ status: string; message: string; data?: any }>('/api/rules/initialize-standard-dataset', {
    method: 'POST',
  });
}


