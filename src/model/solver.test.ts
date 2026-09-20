import { describe, expect, it } from 'vitest';
import { solvePlan } from './solver';
import type { Plan, ProcessStep, Resource } from './types';

function res(id: string, isRaw = false): Resource {
  return { id, name: id, isRaw };
}
function step(id: string, inputs: [string, number][], outputs: [string, number][]): ProcessStep {
  return {
    id,
    name: id,
    inputs: inputs.map(([resourceId, amount]) => ({ resourceId, amount })),
    outputs: outputs.map(([resourceId, amount]) => ({ resourceId, amount })),
  };
}

describe('solvePlan', () => {
  it('solves a linear chain: ore -> plate -> gear', () => {
    const plan: Plan = {
      name: 't',
      resources: [res('ore', true), res('plate'), res('gear')],
      steps: [
        step('smelt', [['ore', 1]], [['plate', 1]]),
        step('gear', [['plate', 2]], [['gear', 1]]),
      ],
      targets: [{ resourceId: 'gear', amount: 10 }],
    };
    const r = solvePlan(plan);
    expect(r.runs.get('gear')).toBeCloseTo(10);
    expect(r.runs.get('smelt')).toBeCloseTo(20);
    expect(r.feasible).toBe(true);
    const ore = r.balances.find((b) => b.resourceId === 'ore')!;
    expect(ore.status).toBe('raw');
    expect(ore.consumed).toBeCloseTo(20);
  });

  it('handles branching consumption (circuit: 3 cable + 1 plate)', () => {
    const plan: Plan = {
      name: 't',
      resources: [res('copper', true), res('iron', true), res('cable'), res('circuit')],
      steps: [
        step('cable', [['copper', 1]], [['cable', 2]]),
        step('circuit', [['cable', 3], ['iron', 1]], [['circuit', 1]]),
      ],
      targets: [{ resourceId: 'circuit', amount: 10 }],
    };
    const r = solvePlan(plan);
    expect(r.runs.get('circuit')).toBeCloseTo(10);
    expect(r.runs.get('cable')).toBeCloseTo(15); // 30 cable / 2 per run
    expect(r.feasible).toBe(true);
    expect(r.balances.find((b) => b.resourceId === 'cable')!.status).toBe('balanced');
  });

  it('marks unproduced intermediates as shortage and infeasible', () => {
    const plan: Plan = {
      name: 't',
      resources: [res('gear'), res('widget')],
      steps: [step('assemble', [['gear', 1]], [['widget', 1]])],
      targets: [{ resourceId: 'widget', amount: 5 }],
    };
    const r = solvePlan(plan);
    expect(r.feasible).toBe(false);
    const gear = r.balances.find((b) => b.resourceId === 'gear')!;
    expect(gear.status).toBe('shortage');
    expect(gear.net).toBeCloseTo(-5);
  });

  it('reports surplus for byproducts of multi-output steps', () => {
    const plan: Plan = {
      name: 't',
      resources: [res('crude', true), res('fuel'), res('gas')],
      steps: [step('refine', [['crude', 10]], [['fuel', 4], ['gas', 6]])],
      targets: [{ resourceId: 'fuel', amount: 8 }],
    };
    const r = solvePlan(plan);
    expect(r.runs.get('refine')).toBeCloseTo(2);
    const gas = r.balances.find((b) => b.resourceId === 'gas')!;
    expect(gas.status).toBe('surplus');
    expect(gas.net).toBeCloseTo(12);
  });

  it('picks one producer when alternatives exist (other clamps to 0)', () => {
    const plan: Plan = {
      name: 't',
      resources: [res('ore', true), res('plate')],
      steps: [
        step('smeltA', [['ore', 1]], [['plate', 1]]),
        step('smeltB', [['ore', 2]], [['plate', 1]]),
      ],
      targets: [{ resourceId: 'plate', amount: 10 }],
    };
    const r = solvePlan(plan);
    const total = (r.runs.get('smeltA') ?? 0) + (r.runs.get('smeltB') ?? 0);
    expect(total).toBeCloseTo(10);
    expect(r.feasible).toBe(true);
  });

  it('scales linearly when the target amount changes', () => {
    const mk = (amount: number): Plan => ({
      name: 't',
      resources: [res('ore', true), res('plate')],
      steps: [step('smelt', [['ore', 1]], [['plate', 1]])],
      targets: [{ resourceId: 'plate', amount }],
    });
    expect(solvePlan(mk(40)).runs.get('smelt')).toBeCloseTo(
      (solvePlan(mk(10)).runs.get('smelt') ?? 0) * 4,
    );
  });

  it('no targets means nothing runs', () => {
    const plan: Plan = {
      name: 't',
      resources: [res('ore', true), res('plate')],
      steps: [step('smelt', [['ore', 1]], [['plate', 1]])],
      targets: [],
    };
    const r = solvePlan(plan);
    expect(r.runs.get('smelt')).toBe(0);
    expect(r.feasible).toBe(true);
  });
});
