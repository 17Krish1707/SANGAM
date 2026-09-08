import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  getLatestRuns,
  getPlan,
  getSections,
  generatePlans,
  type LatestRunsResponse,
  type PlanDetail,
  type Section,
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

  // Actions
  triggerGenerate: (profile?: ObjectiveProfile) => Promise<void>;
  refreshAll: () => Promise<void>;

  // Demo Journey Helper
  isDemoJourneyOpen: boolean;
  setIsDemoJourneyOpen: (open: boolean) => void;
  currentDemoStep: number;
  setCurrentDemoStep: (step: number) => void;
}

const PlanningContext = createContext<PlanningContextType | undefined>(undefined);

export const DEFAULT_DEMO_DATE = '2026-09-07';
export const DEFAULT_CORRIDOR_NAME = 'Station A → Station F (Trunk Route)';

export function PlanningProvider({ children }: { children: React.ReactNode }) {
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(DEFAULT_DEMO_DATE);
  const [selectedHorizon, setSelectedHorizon] = useState<HorizonType>('weekly');
  const [selectedObjectiveProfile, setSelectedObjectiveProfile] = useState<ObjectiveProfile>('balanced');
  const [selectedRunType, setSelectedRunType] = useState<string>('sangam_optimized');

  const [sections, setSections] = useState<Section[]>([]);
  const [latestRuns, setLatestRuns] = useState<LatestRunsResponse | null>(null);
  const [activePlan, setActivePlan] = useState<PlanDetail | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [isLoadingPlan, setIsLoadingPlan] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Demo Journey
  const [isDemoJourneyOpen, setIsDemoJourneyOpen] = useState(false);
  const [currentDemoStep, setCurrentDemoStep] = useState(1);

  // Initial load
  const loadInitial = useCallback(async () => {
    try {
      const [secList, runs] = await Promise.all([
        getSections(),
        getLatestRuns(),
      ]);
      setSections(secList);
      setLatestRuns(runs);

      const sangamId = runs.sangam_optimized?.run_id;
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
        triggerGenerate,
        refreshAll,
        isDemoJourneyOpen,
        setIsDemoJourneyOpen,
        currentDemoStep,
        setCurrentDemoStep,
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
