import { describe, expect, it } from 'vitest';
import { autoLayout } from './layout';
import type { Plan, StepLink } from './types';

function plan(links?: StepLink[]): Plan {
  return {
    name: 'layout',
    resources: [
      { id: 'ore', name: 'Ore', isRaw: true },
      { id: 'plate', name: 'Plate', isRaw: false },
    ],
    steps: [
      { id: 'mine', name: 'Mine', inputs: [], outputs: [{ resourceId: 'ore', amount: 2 }] },
      { id: 'smelt', name: 'Smelt', inputs: [{ resourceId: 'ore', amount: 1 }], outputs: [{ resourceId: 'plate', amount: 1 }] },
      { id: 'spare', name: 'Spare', inputs: [], outputs: [] },
    ],
    targets: [],
    links,
  };
}

function positionOf(planResult: Plan, id: string) {
  return planResult.steps.find((step) => step.id === id)?.position;
}

describe('autoLayout', () => {
  it('puts consumers one column right of their producers', () => {
    const linked: StepLink[] = [
      { id: 'l1', from: { stepId: 'mine', kind: 'output', index: 0 }, to: { stepId: 'smelt', kind: 'input', index: 0 } },
    ];
    const result = autoLayout(plan(linked));
    expect(positionOf(result, 'mine')?.x).toBe(150);
    expect(positionOf(result, 'smelt')?.x).toBe(150 + 260);
  });

  it('separates unconnected steps into rows of the first column', () => {
    const result = autoLayout(plan());
    const mine = positionOf(result, 'mine');
    const smelt = positionOf(result, 'smelt');
    const spare = positionOf(result, 'spare');
    expect(mine?.x).toBe(150);
    expect(smelt?.x).toBe(150);
    expect(spare?.x).toBe(150);
    expect(mine?.y).toBe(120);
    expect(smelt?.y).toBe(120 + 190);
    expect(spare?.y).toBe(120 + 2 * 190);
  });

  it('survives cycles without hanging', () => {
    const cycle: StepLink[] = [
      { id: 'l1', from: { stepId: 'mine', kind: 'output', index: 0 }, to: { stepId: 'smelt', kind: 'input', index: 0 } },
      { id: 'l2', from: { stepId: 'smelt', kind: 'output', index: 0 }, to: { stepId: 'mine', kind: 'input', index: 0 } },
    ];
    const result = autoLayout(plan(cycle));
    expect(result.steps).toHaveLength(3);
    // Both cycle members land on distinct columns one pitch apart;
    // which one goes left is arbitrary for a cycle.
    const mineX = positionOf(result, 'mine')?.x ?? 0;
    const smeltX = positionOf(result, 'smelt')?.x ?? 0;
    expect(Math.abs(mineX - smeltX)).toBe(260);
  });

  it('centers shorter columns vertically', () => {
    const linked: StepLink[] = [
      { id: 'l1', from: { stepId: 'mine', kind: 'output', index: 0 }, to: { stepId: 'smelt', kind: 'input', index: 0 } },
    ];
    const result = autoLayout(plan(linked));
    // Column 0 has two rows, column 1 one row -> smelt is centered between them.
    const mineY = positionOf(result, 'mine')?.y ?? 0;
    const smeltY = positionOf(result, 'smelt')?.y ?? 0;
    expect(smeltY).toBe(mineY + 95);
  });
});
