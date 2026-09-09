/**
 * PlanGenerator — collapsible panel that drives POST /api/plans/generate.
 * Shows a timed step-status list while waiting for the API response.
 * On success, calls onComplete with the three resulting run IDs.
 */
import { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import Panel from '../ui/Panel';
import Button from '../ui/Button';
import { getSections, generatePlans, getLatestRuns, type Section, type GenerateResponse } from '../../lib/apiClient';

const STEPS = [
  'Validating constraints…',
  'Scoring maintenance tasks…',
  'Finding candidate windows…',
  'Building compatibility graph…',
  'Optimising block plan…',
];

export interface PlanRunIds {
  sangam_optimized:     string | null;
  independent_baseline: string | null;
  greedy_baseline:      string | null;
}

interface PlanGeneratorProps {
  onComplete: (ids: PlanRunIds) => void;
  defaultOpen?: boolean;
}

function getMonday(isoDate: string): string {
  const d = new Date(isoDate);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

const OPERATING_TODAY = '2026-09-07';

export default function PlanGenerator({ onComplete, defaultOpen = false }: PlanGeneratorProps) {
  const [open, setOpen]         = useState(defaultOpen);
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [horizon, setHorizon]   = useState<'weekly' | 'monthly'>('weekly');
  const [startDate, setStartDate] = useState(getMonday(OPERATING_TODAY));

  const endDate = horizon === 'weekly'
    ? addDays(startDate, 7)
    : addDays(startDate, 28);

  const [running, setRunning]   = useState(false);
  const [stepIdx, setStepIdx]   = useState(-1);
  const [error, setError]       = useState<string | null>(null);
  const stepTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    getSections().then(setSections).catch(() => {});
  }, []);

  function toggleSection(id: string) {
    setSelectedSections((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  async function handleGenerate() {
    setRunning(true);
    setError(null);
    setStepIdx(0);

    // Advance steps every ~(timeLimit/steps) ms as a UI proxy
    // Real timing: backend typically takes 5-30s, steps are purely cosmetic
    let idx = 0;
    stepTimer.current = setInterval(() => {
      idx = Math.min(idx + 1, STEPS.length - 1);
      setStepIdx(idx);
    }, 1800);

    try {
      const resp: GenerateResponse = await generatePlans({
        section_ids: selectedSections.length > 0 ? selectedSections : undefined,
        start_date: `${startDate}T00:00:00`,
        end_date:   `${endDate}T00:00:00`,
        horizon,
        run_types: ['independent_baseline', 'greedy_baseline', 'sangam_optimized'],
      });

      clearInterval(stepTimer.current!);
      setStepIdx(STEPS.length); // all done

      // Extract run IDs from response
      const ids: PlanRunIds = {
        sangam_optimized:     null,
        independent_baseline: null,
        greedy_baseline:      null,
      };
      for (const run of resp.runs) {
        if (run.run_type === 'sangam_optimized')     ids.sangam_optimized     = run.run_id;
        if (run.run_type === 'independent_baseline') ids.independent_baseline = run.run_id;
        if (run.run_type === 'greedy_baseline')      ids.greedy_baseline      = run.run_id;
      }

      // Brief pause so user sees "all done" before panel collapses
      setTimeout(() => {
        setRunning(false);
        setStepIdx(-1);
        setOpen(false);
        onComplete(ids);
      }, 600);

    } catch (e: unknown) {
      clearInterval(stepTimer.current!);
      setRunning(false);
      setStepIdx(-1);
      setError(e instanceof Error ? e.message : 'Generation failed. Check the backend logs.');
    }
  }

  async function handleLoadLatest() {
    try {
      const latest = await getLatestRuns();
      onComplete({
        sangam_optimized:     latest.sangam_optimized?.run_id     ?? null,
        independent_baseline: latest.independent_baseline?.run_id ?? null,
        greedy_baseline:      latest.greedy_baseline?.run_id      ?? null,
      });
    } catch {
      setError('Could not load latest runs.');
    }
  }

  return (
    <div className="mb-5">
      {/* Collapsible header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3 bg-white border border-border rounded-card text-sm font-semibold text-text-primary hover:bg-panel transition-colors"
        aria-expanded={open}
      >
        <span>Generate Block Plan</span>
        <div className="flex items-center gap-3">
          <button
            onClick={(e) => { e.stopPropagation(); handleLoadLatest(); }}
            className="text-xs font-normal text-accent hover:text-accent-hover"
            title="Load the most recently completed run"
          >
            Load latest
          </button>
          {open ? <ChevronUp className="w-4 h-4 text-text-secondary" /> : <ChevronDown className="w-4 h-4 text-text-secondary" />}
        </div>
      </button>

      {open && (
        <Panel className="mt-1 rounded-t-none border-t-0">
          {/* Controls row */}
          <div className="flex flex-wrap gap-5 mb-5">

            {/* Horizon toggle */}
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-text-secondary">Horizon</span>
              <div className="flex items-center gap-0 border border-border rounded-md overflow-hidden text-xs">
                {(['weekly', 'monthly'] as const).map((h) => (
                  <button
                    key={h}
                    onClick={() => setHorizon(h)}
                    disabled={running}
                    className={`px-4 py-1.5 font-medium capitalize transition-colors
                      ${horizon === h ? 'bg-accent text-white' : 'bg-white text-text-secondary hover:bg-panel'}`}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>

            {/* Start date */}
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-text-secondary">Start Date</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={running}
                className="text-sm border border-border rounded-md px-3 py-1.5 bg-white text-text-primary
                           focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
              />
            </div>

            {/* End date (read-only derived) */}
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-text-secondary">End Date</span>
              <input
                type="date"
                value={endDate}
                readOnly
                className="text-sm border border-border rounded-md px-3 py-1.5 bg-panel text-text-secondary"
              />
            </div>
          </div>

          {/* Section multi-select */}
          {sections.length > 0 && (
            <div className="mb-5">
              <span className="text-xs font-medium text-text-secondary block mb-1.5">
                Sections <span className="text-text-secondary font-normal">(none = all)</span>
              </span>
              <div className="flex flex-wrap gap-2">
                {sections.map((s) => {
                  const active = selectedSections.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() => toggleSection(s.id)}
                      disabled={running}
                      className={`px-3 py-1 text-xs rounded-md border transition-colors
                        ${active
                          ? 'bg-accent text-white border-accent'
                          : 'bg-white text-text-secondary border-border hover:bg-panel'}`}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Generate button */}
          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              size="md"
              disabled={running}
              onClick={handleGenerate}
            >
              {running && <Loader2 className="w-4 h-4 animate-spin" />}
              {running ? 'Generating…' : 'Generate Plan'}
            </Button>
          </div>

          {/* Step status list */}
          {running && (
            <ol className="mt-4 space-y-1.5">
              {STEPS.map((step, i) => {
                const done    = i < stepIdx;
                const current = i === stepIdx;
                return (
                  <li key={step} className="flex items-center gap-2 text-xs">
                    {done
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-status-good-text flex-shrink-0" />
                      : current
                        ? <Loader2 className="w-3.5 h-3.5 text-accent animate-spin flex-shrink-0" />
                        : <Circle className="w-3.5 h-3.5 text-border flex-shrink-0" />}
                    <span className={done ? 'text-text-secondary line-through' : current ? 'text-text-primary font-medium' : 'text-text-secondary'}>
                      {step}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}

          {/* Error */}
          {error && (
            <p className="mt-3 text-xs text-status-critical-text bg-status-critical-bg rounded-md px-3 py-2">
              {error}
            </p>
          )}
        </Panel>
      )}
    </div>
  );
}
