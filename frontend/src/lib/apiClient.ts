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
  from_station: string;
  to_station: string;
  line_type: string;
  section_capacity_notes: string | null;
}

export function getSections(): Promise<Section[]> {
  return request<Section[]>('/api/sections');
}

// ─────────────────────────────────────────────
// Maintenance Tasks
// ─────────────────────────────────────────────

export interface MaintenanceTask {
  id: string;
  task_code: string;
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
  if (filters.status)      params.set('status',      filters.status);
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
}

export interface GeneratedBlock {
  id: string;
  run_id: string;
  section_id: string;
  section_name: string | null;
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
}

export function getPlan(runId: string): Promise<PlanDetail> {
  return request<PlanDetail>(`/api/plans/${runId}`);
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
    components: Record<string, { contribution: number; detail: string }>;
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
  train_type: 'Passenger' | 'Goods';
  entry_time: string;
  exit_time: string;
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

export function getSectionOccupancy(sectionId: string, targetDate = '2026-09-07'): Promise<SectionOccupancyData> {
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

