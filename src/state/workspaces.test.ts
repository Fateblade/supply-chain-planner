import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Plan } from '../model/types';
import { loadWorkspaceState } from './workspaces';

const STATE_KEY = 'supply-chain-planner:workspaces:v1';
const LEGACY_PLAN_KEY = 'supply-chain-planner:plan:v1';
const LEGACY_STEP_KEY = 'supply-chain-planner:step-templates:v1';
const LEGACY_PLAN_TEMPLATES_KEY = 'supply-chain-planner:plan-templates:v1';

function installStorage(initial: Record<string, string>) {
  const values = new Map(Object.entries(initial));
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
  return values;
}

const existingPlan: Plan = {
  name: 'Shipyard',
  resources: [{ id: 'alloy', name: 'Alloy', isRaw: true }],
  steps: [],
  targets: [],
};

afterEach(() => vi.unstubAllGlobals());

describe('workspace persistence migration', () => {
  it('migrates the legacy plan and both libraries without losing data', () => {
    const values = installStorage({
      [LEGACY_PLAN_KEY]: JSON.stringify(existingPlan),
      [LEGACY_STEP_KEY]: JSON.stringify([{ id: 'step-template', name: 'Forge', inputs: [], outputs: [] }]),
      [LEGACY_PLAN_TEMPLATES_KEY]: JSON.stringify([{ id: 'plan-template', name: 'Starter', plan: existingPlan }]),
    });

    const state = loadWorkspaceState();
    const workspace = state.workspaces[0];
    expect(workspace.name).toBe('Game: Spacecraft');
    expect(workspace.plans[0].name).toBe('Shipyard');
    expect(workspace.resources).toEqual(existingPlan.resources);
    expect(workspace.stepTemplates[0].id).toBe('step-template');
    expect(workspace.planTemplates[0].id).toBe('plan-template');
    expect(JSON.parse(values.get(STATE_KEY) ?? 'null')).toEqual(state);
  });

  it('loads the workspace document after migration instead of remigrating legacy data', () => {
    const values = installStorage({ [LEGACY_PLAN_KEY]: JSON.stringify(existingPlan) });
    const migrated = loadWorkspaceState();
    values.set(LEGACY_PLAN_KEY, JSON.stringify({ ...existingPlan, name: 'Changed legacy copy' }));
    const loaded = loadWorkspaceState();
    expect(loaded).toEqual(migrated);
  });
});
