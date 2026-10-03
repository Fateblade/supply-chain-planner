import { describe, expect, it } from 'vitest';
import type { Plan } from './types';
import { createWorkspace, migrateWorkspace, restorePlan, savePlanSnapshot, updateActivePlan } from './workspaces';

function plan(name = 'Existing Plan'): Plan {
  return {
    name,
    resources: [{ id: 'iron', name: 'Iron', isRaw: true }],
    steps: [{
      id: 'smelt', name: 'Smelt', inputs: [{ resourceId: 'iron', amount: 1 }],
      outputs: [{ resourceId: 'iron', amount: 1 }], position: { x: 200, y: 160 },
    }],
    targets: [{ resourceId: 'iron', amount: 2 }],
    links: [],
  };
}

describe('workspace model', () => {
  it('stores plans without duplicating the workspace resource catalog', () => {
    const workspace = createWorkspace('Game: Spacecraft', plan());
    const saved = workspace.plans[0];
    expect(workspace.name).toBe('Game: Spacecraft');
    expect(workspace.resources).toEqual([{ id: 'iron', name: 'Iron', isRaw: true }]);
    expect('resources' in saved).toBe(false);
    expect(restorePlan(saved, workspace.resources)).toEqual(plan());
  });

  it('migrates existing plan and libraries into the initial workspace', () => {
    const stepTemplates = [{
      id: 'step-template', name: 'Smelt template', inputs: [{ resourceName: 'Iron', amount: 1 }], outputs: [],
    }];
    const planTemplates = [{ id: 'plan-template', name: 'Starter', plan: plan() }];
    const state = migrateWorkspace('Game: Spacecraft', plan(), stepTemplates, planTemplates);
    const workspace = state.workspaces[0];
    expect(state.activeWorkspaceId).toBe(workspace.id);
    expect(workspace.name).toBe('Game: Spacecraft');
    expect(restorePlan(workspace.plans[0], workspace.resources)).toEqual(plan());
    expect(workspace.stepTemplates).toEqual(stepTemplates);
    expect(workspace.planTemplates).toEqual(planTemplates);
  });

  it('removes a deleted shared resource from every saved plan in its workspace', () => {
    const workspace = createWorkspace('Workshop', plan());
    const otherPlan = savePlanSnapshot(plan('Other Plan'), 'other-plan');
    const withTwoPlans = { ...workspace, plans: [...workspace.plans, otherPlan] };
    const active = restorePlan(workspace.plans[0], workspace.resources);
    const withoutResource = {
      ...active,
      resources: [],
      steps: [{ ...active.steps[0], inputs: [], outputs: [] }],
      targets: [],
    };
    const updated = updateActivePlan(withTwoPlans, withoutResource);
    const other = updated.plans.find((saved) => saved.id === 'other-plan');
    expect(updated.resources).toEqual([]);
    expect(other && restorePlan(other, updated.resources).steps[0].inputs).toEqual([]);
    expect(other && restorePlan(other, updated.resources).targets).toEqual([]);
  });

  it('keeps saved-plan identity stable when saving edits', () => {
    const snapshot = savePlanSnapshot(plan(), 'existing-id');
    const edited = savePlanSnapshot({ ...plan(), name: 'Edited' }, snapshot.id);
    expect(edited.id).toBe('existing-id');
    expect(edited.name).toBe('Edited');
  });
});
