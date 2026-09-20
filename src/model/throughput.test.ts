import { describe, expect, it } from 'vitest';
import { stationRequirements } from './throughput';
import type { Plan, ProcessStep, Resource } from './types';

function res(id: string, isRaw = false): Resource {
  return { id, name: id, isRaw };
}
function step(
  id: string,
  inputs: [string, number][],
  outputs: [string, number][],
  durationSeconds?: number,
): ProcessStep {
  return {
    id,
    name: id,
    inputs: inputs.map(([resourceId, amount]) => ({ resourceId, amount })),
    outputs: outputs.map(([resourceId, amount]) => ({ resourceId, amount })),
    durationSeconds,
  };
}

describe('stationRequirements', () => {
  it('computes stations from rate and duration', () => {
    // 60 plates/min = 1 plate/s; smelt takes 2s per plate -> 2 stations
    const plan: Plan = {
      name: 't',
      resources: [res('ore', true), res('plate')],
      steps: [step('smelt', [['ore', 1]], [['plate', 1]], 2)],
      targets: [{ resourceId: 'plate', amount: 60, perSeconds: 60 }],
    };
    const t = stationRequirements(plan).get('smelt')!;
    expect(t.runsPerSecond).toBeCloseTo(1);
    expect(t.stations).toBe(2);
  });

  it('rounds fractional station counts up', () => {
    // 30 cable/min = 0.5 runs/s of a 2-output step; duration 0.5s -> 0.25 stations -> 1
    const plan: Plan = {
      name: 't',
      resources: [res('copper', true), res('cable')],
      steps: [step('draw', [['copper', 1]], [['cable', 2]], 0.5)],
      targets: [{ resourceId: 'cable', amount: 30, perSeconds: 60 }],
    };
    const t = stationRequirements(plan).get('draw')!;
    expect(t.runsPerSecond).toBeCloseTo(0.25);
    expect(t.stations).toBe(1);
  });

  it('returns null stations when a step has no duration', () => {
    const plan: Plan = {
      name: 't',
      resources: [res('ore', true), res('plate')],
      steps: [step('smelt', [['ore', 1]], [['plate', 1]])],
      targets: [{ resourceId: 'plate', amount: 60, perSeconds: 60 }],
    };
    const t = stationRequirements(plan).get('smelt')!;
    expect(t.runsPerSecond).toBeCloseTo(1);
    expect(t.stations).toBeNull();
  });

  it('ignores one-off targets for station capacity', () => {
    const plan: Plan = {
      name: 't',
      resources: [res('ore', true), res('plate')],
      steps: [step('smelt', [['ore', 1]], [['plate', 1]], 2)],
      targets: [{ resourceId: 'plate', amount: 100 }],
    };
    const t = stationRequirements(plan).get('smelt')!;
    expect(t.runsPerSecond).toBe(0);
    expect(t.stations).toBe(0);
  });

  it('sums rates across multiple rate targets sharing a chain', () => {
    // gear needs 2 plates; 30 gears/min + 30 plates/min = 1.5 plate/s on 2s smelts -> 3 stations
    const plan: Plan = {
      name: 't',
      resources: [res('ore', true), res('plate'), res('gear')],
      steps: [
        step('smelt', [['ore', 1]], [['plate', 1]], 2),
        step('gear', [['plate', 2]], [['gear', 1]], 1),
      ],
      targets: [
        { resourceId: 'gear', amount: 30, perSeconds: 60 },
        { resourceId: 'plate', amount: 30, perSeconds: 60 },
      ],
    };
    const smelt = stationRequirements(plan).get('smelt')!;
    expect(smelt.runsPerSecond).toBeCloseTo(1.5);
    expect(smelt.stations).toBe(3);
    const gear = stationRequirements(plan).get('gear')!;
    expect(gear.runsPerSecond).toBeCloseTo(0.5);
    expect(gear.stations).toBe(1);
  });
});
