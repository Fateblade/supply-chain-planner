import type { Plan } from '../model/types';
import type { PlanTemplate, StepTemplate } from '../model/templates';
import { activeWorkspace, migrateWorkspace, type WorkspaceState } from '../model/workspaces';
import { samplePlan } from '../model/sample';

const STATE_KEY = 'supply-chain-planner:workspaces:v1';
const PLAN_KEY = 'supply-chain-planner:plan:v1';
const STEP_KEY = 'supply-chain-planner:step-templates:v1';
const PLAN_TEMPLATE_KEY = 'supply-chain-planner:plan-templates:v1';

function readArray<T>(key: string): T[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

function validState(value: unknown): value is WorkspaceState {
  if (!value || typeof value !== 'object') return false;
  const state = value as WorkspaceState;
  return Array.isArray(state.workspaces) && state.workspaces.length > 0 &&
    state.workspaces.every((workspace) =>
      typeof workspace.id === 'string' && typeof workspace.name === 'string' &&
      Array.isArray(workspace.resources) && Array.isArray(workspace.plans) &&
      workspace.plans.length > 0 && typeof workspace.activePlanId === 'string' &&
      Array.isArray(workspace.stepTemplates) && Array.isArray(workspace.planTemplates),
    ) && state.workspaces.some((workspace) => workspace.id === state.activeWorkspaceId);
}

export function loadWorkspaceState(): WorkspaceState {
  try {
    const saved = localStorage.getItem(STATE_KEY);
    if (saved) {
      const parsed: unknown = JSON.parse(saved);
      if (validState(parsed)) return parsed;
    }
  } catch {
    // Invalid or unavailable stored state falls through to one-time legacy migration.
  }

  let plan: Plan = samplePlan();
  try {
    const legacy = localStorage.getItem(PLAN_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy) as Plan;
      if (Array.isArray(parsed.resources) && Array.isArray(parsed.steps)) {
        plan = { ...parsed, targets: Array.isArray(parsed.targets) ? parsed.targets : [] };
      }
    }
  } catch {
    // Keep the sample plan when legacy data cannot be decoded.
  }

  const migrated = migrateWorkspace(
    'Game: Spacecraft',
    plan,
    readArray<StepTemplate>(STEP_KEY),
    readArray<PlanTemplate>(PLAN_TEMPLATE_KEY),
  );
  saveWorkspaceState(migrated);
  return migrated;
}

export function saveWorkspaceState(state: WorkspaceState): void {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or unavailable; keep editing available in this session.
  }
}

export function currentPlan(state: WorkspaceState): Plan {
  const workspace = activeWorkspace(state);
  const savedPlan = workspace.plans.find((plan) => plan.id === workspace.activePlanId) ?? workspace.plans[0];
  const { id: _id, ...plan } = savedPlan;
  return { ...plan, resources: workspace.resources };
}
