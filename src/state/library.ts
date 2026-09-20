import type { PlanTemplate, StepTemplate } from '../model/templates';

const STEP_KEY = 'supply-chain-planner:step-templates:v1';
const PLAN_KEY = 'supply-chain-planner:plan-templates:v1';

function load<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function save<T>(key: string, items: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // storage unavailable — library still works for the session
  }
}

export const loadStepTemplates = (): StepTemplate[] => load<StepTemplate>(STEP_KEY);
export const saveStepTemplates = (t: StepTemplate[]): void => save(STEP_KEY, t);
export const loadPlanTemplates = (): PlanTemplate[] => load<PlanTemplate>(PLAN_KEY);
export const savePlanTemplates = (t: PlanTemplate[]): void => save(PLAN_KEY, t);
