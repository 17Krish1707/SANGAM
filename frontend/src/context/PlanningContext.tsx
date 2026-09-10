import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  getLatestRuns,
  getPlan,
  getSections,
  generatePlans,
  getTasks,
  getAllTrains,
  getResources,
  getPlanFreshness,
  type LatestRunsResponse,
  type PlanDetail,
  type Section,
  type PlanFreshnessResponse,
} from '../lib/apiClient';

export type ObjectiveProfile = 'balanced' | 'max_availability' | 'min_train_impact';
export type HorizonType = 'weekly' | 'monthly';

interface PlanningContextType {
  // Navigation & Selection state
  selectedSectionId: string | null;
  setSelectedSectionId: (id: string | null) => void;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  selectedHorizon: HorizonType;
  setSelectedHorizon: (h: HorizonType) => void;
  selectedObjectiveProfile: ObjectiveProfile;
  setSelectedObjectiveProfile: (p: ObjectiveProfile) => void;
  selectedRunType: string;
  setSelectedRunType: (rt: string) => void;

  // Data state
  sections: Section[];
  latestRuns: LatestRunsResponse | null;
  activePlan: PlanDetail | null;
  activeRunId: string | null;
  isLoadingPlan: boolean;
  isGenerating: boolean;

  // Prerequisite Counts & Stage Readiness
  tasksCount: number;
  trainsCount: number;
  resourcesCount: number;
  getStageStatus: (stageNum: number) => { isComplete: boolean; reason?: string };

  // User Role & Workflow
  userRole: 'Planner' | 'Controller';
  setUserRole: (r: 'Planner' | 'Controller') => void;
  workflowStage: number; // 1: Maintenance, 2: Corridor, 3: Resources, 4: Optimize, 5: Review, 6: Approve
  setWorkflowStage: (s: number) => void;

  // Dynamic Plan Freshness & Conflicts
  planFreshness: PlanFreshnessResponse | null;
  checkFreshness: () => Promise<void>;

  // Actions
  triggerGenerate: (profile?: ObjectiveProfile) => Promise<void>;
  refreshAll: () => Promise<void>;
}

const PlanningContext = createContext<PlanningContextType | undefined>(undefined);

export const DEFAULT_OPERATING_DATE = new Date().toISOString().split('T')[0];
export const DEFAULT_CORRIDOR_NAME = 'Mumbai Suburban Corridor';

export function PlanningProvider({ children }: { children: React.ReactNode }) {
  const [userRole, setUserRole] = useState<'Planner' | 'Controller'>('Controller');
  const [workflowStage, setWorkflowStage] = useState<number>(1);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(DEFAULT_OPERATING_DATE);
  const [selectedHorizon, setSelectedHorizon] = useState<HorizonType>('weekly');
  const [selectedObjectiveProfile, setSelectedObjectiveProfile] = useState<ObjectiveProfile>('balanced');
  const [selectedRunType, setSelectedRunType] = useState<string>('sangam_optimized');

  const [sections, setSections] = useState<Section[]>([]);
  const [latestRuns, setLatestRuns] = useState<LatestRunsResponse | null>(null);
  const [activePlan, setActivePlan] = useState<PlanDetail | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [isLoadingPlan, setIsLoadingPlan] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Prerequisite Counts
  const [tasksCount, setTasksCount] = useState<number>(0);
  const [trainsCount, setTrainsCount] = useState<number>(0);
  const [resourcesCount, setResourcesCount] = useState<number>(0);
  const [planFreshness, setPlanFreshness] = useState<PlanFreshnessResponse | null>(null);

  const checkFreshness = useCallback(async (runId?: string) => {
    try {
      const freshness = await getPlanFreshness(runId || activeRunId || undefined);
      setPlanFreshness(freshness);
    } catch (err) {
      console.error('Failed to check plan freshness:', err);
    }
  }, [activeRunId]);

  // Initial load
  const loadInitial = useCallback(async () => {
    try {
      const [secList, runs, taskList, trainList, resList, freshness] = await Promise.all([
        getSections().catch(() => []),
        getLatestRuns().catch(() => null),
        getTasks().catch(() => []),
        getAllTrains().catch(() => []),
        getResources().catch(() => []),
        getPlanFreshness().catch(() => null),
      ]);
      setSections(secList);
      setLatestRuns(runs);
      setTasksCount(taskList.length);
      setTrainsCount(trainList.length);
      setResourcesCount(resList.length);
      if (freshness) setPlanFreshness(freshness);

      const sangamId = runs?.sangam_optimized?.run_id;
      if (sangamId) {
        setActiveRunId(sangamId);
        setIsLoadingPlan(true);
        const plan = await getPlan(sangamId);
        setActivePlan(plan);
        setIsLoadingPlan(false);
      }
    } catch (err) {
      console.error('Failed to load planning context:', err);
    }
  }, []);

  const getStageStatus = useCallback(
    (stageNum: number) => {
      const hasSections = sections.length > 0;
      const hasTasks = tasksCount > 0;
      const hasTrains = trainsCount > 0;
      const hasResources = resourcesCount > 0;
      const hasPlan = Boolean(latestRuns?.sangam_optimized?.run_id || activePlan);
      const hasBlocks = Boolean(activePlan?.blocks && activePlan.blocks.length > 0);
      const hasApprovedBlocks = Boolean(
        activePlan?.blocks && activePlan.blocks.some((b) => b.approval_status === 'approved')
      );

      switch (stageNum) {
        case 1: // Maintenance Demand
          return {
            isComplete: hasTasks,
            reason: hasTasks ? `${tasksCount} Tasks Registered` : 'No Maintenance Tasks in Register',
          };
        case 2: // Corridor & Trains
          return {
            isComplete: hasSections && hasTrains,
            reason: !hasSections
              ? 'No Corridor Sections'
              : !hasTrains
              ? 'No Timetable Trains'
              : `${sections.length} Sections, ${trainsCount} Trains`,
          };
        case 3: // Resources
          return {
            isComplete: hasResources,
            reason: hasResources ? `${resourcesCount} Gangs & Machines` : 'No Resources Registered',
          };
        case 4: // Create Plan (Optimization)
          return {
            isComplete: hasPlan,
            reason: hasPlan ? 'Optimization Plan Generated' : 'Block Plan Not Yet Generated',
          };
        case 5: // Proposed Plan (Review & Edit)
          return {
            isComplete: hasBlocks,
            reason: hasBlocks ? `${activePlan!.blocks.length} Blocks Proposed` : 'No Proposed Blocks in Schedule',
          };
        case 6: // Approval Desk (Sanction)
          return {
            isComplete: hasApprovedBlocks,
            reason: hasApprovedBlocks ? 'Possession Blocks Approved' : 'No Blocks Sanctioned Yet',
          };
        default:
          return { isComplete: false, reason: 'Unknown Stage' };
      }
    },
    [sections.length, tasksCount, trainsCount, resourcesCount, latestRuns, activePlan]
  );

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  // Load plan when activeRunId or selectedRunType changes
  const loadPlanForType = useCallback(async (runType: string, runs: LatestRunsResponse | null) => {
    if (!runs) return;
    const info = (runs as any)[runType];
    if (info?.run_id) {
      setActiveRunId(info.run_id);
      setIsLoadingPlan(true);
      try {
        const plan = await getPlan(info.run_id);
        setActivePlan(plan);
      } catch (err) {
        console.error('Error fetching plan:', err);
      } finally {
        setIsLoadingPlan(false);
      }
    }
  }, []);

  const handleSetSelectedRunType = (rt: string) => {
    setSelectedRunType(rt);
    loadPlanForType(rt, latestRuns);
  };

  const triggerGenerate = async (profile: ObjectiveProfile = selectedObjectiveProfile) => {
    setIsGenerating(true);
    try {
      const resp = await generatePlans({
        horizon: selectedHorizon,
        objective_profile: profile,
        run_types: ['independent_baseline', 'greedy_baseline', 'sangam_optimized'],
      });
      const sangamRun = resp.runs.find((r) => r.run_type === 'sangam_optimized');
      const updatedRuns = await getLatestRuns();
      setLatestRuns(updatedRuns);

      if (sangamRun?.run_id) {
        setActiveRunId(sangamRun.run_id);
        setSelectedRunType('sangam_optimized');
        setIsLoadingPlan(true);
        const plan = await getPlan(sangamRun.run_id);
        setActivePlan(plan);
        setIsLoadingPlan(false);
      }
    } catch (err) {
      console.error('Failed to generate plans:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const refreshAll = async () => {
    await loadInitial();
  };

  return (
    <PlanningContext.Provider
      value={{
        userRole,
        setUserRole,
        workflowStage,
        setWorkflowStage,
        selectedSectionId,
        setSelectedSectionId,
        selectedDate,
        setSelectedDate,
        selectedHorizon,
        setSelectedHorizon,
        selectedObjectiveProfile,
        setSelectedObjectiveProfile,
        selectedRunType,
        setSelectedRunType: handleSetSelectedRunType,
        sections,
        latestRuns,
        activePlan,
        activeRunId,
        isLoadingPlan,
        isGenerating,
        tasksCount,
        trainsCount,
        resourcesCount,
        planFreshness,
        checkFreshness,
        getStageStatus,
        triggerGenerate,
        refreshAll,
      }}
    >
      {children}
    </PlanningContext.Provider>
  );
}

export function usePlanningContext() {
  const ctx = useContext(PlanningContext);
  if (!ctx) {
    throw new Error('usePlanningContext must be used within a PlanningProvider');
  }
  return ctx;
}

export const usePlanning = usePlanningContext;
