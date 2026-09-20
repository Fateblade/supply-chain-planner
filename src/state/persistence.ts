import type { Plan } from '../model/types';

const KEY = 'supply-chain-planner:plan:v1';

export function loadPlan(): Plan | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const plan = JSON.parse(raw) as Plan;
    if (!Array.isArray(plan.resources) || !Array.isArray(plan.steps) || !Array.isArray(plan.targets)) {
      return null;
    }
    return plan;
  } catch {
    return null;
  }
}

export function savePlan(plan: Plan): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(plan));
  } catch {
    // storage full or unavailable — editing still works for the session
  }
}

export function exportPlan(plan: Plan): void {
  const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${plan.name.replace(/[^\w-]+/g, '_') || 'plan'}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
