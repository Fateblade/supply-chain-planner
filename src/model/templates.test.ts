import { describe, expect, it } from 'vitest';
import {
  instantiatePlanTemplate,
  instantiateStepTemplate,
  stepToTemplate,
  type PlanTemplate,
} from './templates';
import { newId, type Plan } from './types';

function basePlan(): Plan {
  const ore = newId();
  const plate = newId();
  return {
    name: 'p',
    resources: [
      { id: ore, name: 'Ore', isRaw: true },
      { id: plate, name: 'Plate', isRaw: false },
    ],
    steps: [
      {
        id: newId(),
        name: 'Smelt',
        inputs: [{ resourceId: ore, amount: 1 }],
        outputs: [{ resourceId: plate, amount: 1 }],
        durationSeconds: 2,
      },
    ],
    targets: [],
  };
}

describe('stepToTemplate', () => {
  it('stores resource references by name and keeps duration', () => {
    const plan = basePlan();
    const tpl = stepToTemplate(plan.steps[0], plan);
    expect(tpl.name).toBe('Smelt');
    expect(tpl.durationSeconds).toBe(2);
    expect(tpl.inputs).toEqual([{ resourceName: 'Ore', amount: 1 }]);
    expect(tpl.outputs).toEqual([{ resourceName: 'Plate', amount: 1 }]);
  });
});

describe('instantiateStepTemplate', () => {
  it('resolves existing resources by name without duplicating them', () => {
    const plan = basePlan();
    const tpl = stepToTemplate(plan.steps[0], plan);
    const next = instantiateStepTemplate(plan, tpl);
    expect(next.resources).toHaveLength(2);
    expect(next.steps).toHaveLength(2);
    const inserted = next.steps[1];
    expect(inserted.id).not.toBe(plan.steps[0].id);
    expect(inserted.inputs[0].resourceId).toBe(plan.resources[0].id);
    expect(inserted.outputs[0].resourceId).toBe(plan.resources[1].id);
  });

  it('matches resource names case-insensitively', () => {
    const plan = basePlan();
    const tpl = stepToTemplate(plan.steps[0], plan);
    tpl.inputs[0].resourceName = 'ore';
    const next = instantiateStepTemplate(plan, tpl);
    expect(next.resources).toHaveLength(2);
  });

  it('creates resources that the plan does not have yet', () => {
    const plan = basePlan();
    const tpl = stepToTemplate(plan.steps[0], plan);
    tpl.outputs = [{ resourceName: 'Steel plate', amount: 1 }];
    const next = instantiateStepTemplate(plan, tpl);
    expect(next.resources).toHaveLength(3);
    const created = next.resources.find((r) => r.name === 'Steel plate')!;
    expect(next.steps[1].outputs[0].resourceId).toBe(created.id);
  });
});

describe('instantiatePlanTemplate', () => {
  it('returns a deep copy that does not share state with the template', () => {
    const tpl: PlanTemplate = { id: newId(), name: 'base', plan: basePlan() };
    const copy = instantiatePlanTemplate(tpl);
    copy.steps[0].name = 'changed';
    copy.resources[0].name = 'changed';
    expect(tpl.plan.steps[0].name).toBe('Smelt');
    expect(tpl.plan.resources[0].name).toBe('Ore');
  });
});
