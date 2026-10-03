import type { Plan, Resource } from './types';
import type { PlanTemplate, StepTemplate } from './templates';
import { removeResourceAndLinks } from './links';
import { newId } from './types';

export interface SavedWorkspacePlan extends Omit<Plan, 'resources'> {
  id: string;
}

export interface Workspace {
  id: string;
  name: string;
  resources: Resource[];
  plans: SavedWorkspacePlan[];
  activePlanId: string;
  stepTemplates: StepTemplate[];
  planTemplates: PlanTemplate[];
}

export interface WorkspaceState {
  workspaces: Workspace[];
  activeWorkspaceId: string;
}

export function savePlanSnapshot(plan: Plan, id = newId()): SavedWorkspacePlan {
  const { resources: _resources, ...snapshot } = plan;
  return { ...snapshot, id };
}

export function restorePlan(snapshot: SavedWorkspacePlan, resources: Resource[]): Plan {
  const { id: _id, ...plan } = snapshot;
  return { ...plan, resources };
}

export function updateActivePlan(workspace: Workspace, nextPlan: Plan): Workspace {
  const nextResourceIds = new Set(nextPlan.resources.map((resource) => resource.id));
  const removedIds = workspace.resources
    .filter((resource) => !nextResourceIds.has(resource.id))
    .map((resource) => resource.id);
  let plans = workspace.plans;
  for (const resourceId of removedIds) {
    plans = plans.map((saved) => {
      const restored = restorePlan(saved, workspace.resources);
      const cleaned = removeResourceAndLinks(restored, resourceId);
      return savePlanSnapshot(
        { ...cleaned, targets: cleaned.targets.filter((target) => target.resourceId !== resourceId) },
        saved.id,
      );
    });
  }

  const snapshot = savePlanSnapshot({ ...nextPlan, resources: nextPlan.resources }, workspace.activePlanId);
  const existing = plans.some((saved) => saved.id === workspace.activePlanId);
  plans = existing
    ? plans.map((saved) => saved.id === workspace.activePlanId ? snapshot : saved)
    : [...plans, snapshot];
  return { ...workspace, resources: nextPlan.resources, plans };
}

export function createWorkspace(name: string, plan: Plan): Workspace {
  const savedPlan = savePlanSnapshot(plan);
  return {
    id: newId(),
    name: name.trim() || 'Untitled workspace',
    resources: structuredClone(plan.resources),
    plans: [savedPlan],
    activePlanId: savedPlan.id,
    stepTemplates: [],
    planTemplates: [],
  };
}

export function migrateWorkspace(
  name: string,
  plan: Plan,
  stepTemplates: StepTemplate[],
  planTemplates: PlanTemplate[],
): WorkspaceState {
  const workspace = createWorkspace(name, plan);
  workspace.stepTemplates = stepTemplates;
  workspace.planTemplates = planTemplates;
  return { workspaces: [workspace], activeWorkspaceId: workspace.id };
}

export function activeWorkspace(state: WorkspaceState): Workspace {
  return state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId) ?? state.workspaces[0];
}

export function activeSavedPlan(workspace: Workspace): SavedWorkspacePlan {
  return workspace.plans.find((plan) => plan.id === workspace.activePlanId) ?? workspace.plans[0];
}
