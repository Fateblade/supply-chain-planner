import { describe, expect, it } from 'vitest';
import { connectPorts, removePortAndLinks, removeResourceAndLinks, removeStepAndLinks } from './links';
import type { Plan } from './types';

function plan(): Plan {
  return {
    name: 'links',
    resources: [
      { id: 'ore', name: 'Ore', isRaw: true },
      { id: 'plate', name: 'Plate', isRaw: false },
      { id: 'gear', name: 'Gear', isRaw: false },
    ],
    steps: [
      {
        id: 'smelt',
        name: 'Smelt',
        inputs: [{ resourceId: 'ore', amount: 1 }],
        outputs: [{ resourceId: 'plate', amount: 1 }],
      },
      {
        id: 'assemble',
        name: 'Assemble',
        inputs: [{ resourceId: 'gear', amount: 1 }],
        outputs: [{ resourceId: 'gear', amount: 1 }],
      },
    ],
    targets: [],
  };
}

describe('step links', () => {
  it('links existing ports and uses the source resource on the target port', () => {
    const connected = connectPorts(
      plan(),
      { stepId: 'smelt', kind: 'output', index: 0 },
      { stepId: 'assemble', kind: 'input', index: 0 },
      'plate',
    );

    expect(connected.steps[1].inputs[0].resourceId).toBe('plate');
    expect(connected.links).toHaveLength(1);
    expect(connected.links?.[0].from.index).toBe(0);

    const repeated = connectPorts(
      connected,
      { stepId: 'smelt', kind: 'output', index: 0 },
      { stepId: 'assemble', kind: 'input', index: 0 },
      'plate',
    );
    expect(repeated.links).toHaveLength(1);
  });

  it('removes a port link and shifts later port indexes', () => {
    const connected = connectPorts(
      {
        ...plan(),
        steps: [
          plan().steps[0],
          {
            ...plan().steps[1],
            inputs: [
              { resourceId: 'ore', amount: 1 },
              { resourceId: 'gear', amount: 1 },
            ],
          },
        ],
      },
      { stepId: 'smelt', kind: 'output', index: 0 },
      { stepId: 'assemble', kind: 'input', index: 1 },
      'plate',
    );
    const removed = removePortAndLinks(connected, 'assemble', 'input', 0);
    expect(removed.steps[1].inputs).toHaveLength(1);
    expect(removed.links?.[0].to.index).toBe(0);
  });

  it('removes links when a step or resource is deleted', () => {
    const connected = connectPorts(
      plan(),
      { stepId: 'smelt', kind: 'output', index: 0 },
      { stepId: 'assemble', kind: 'input', index: 0 },
      'plate',
    );
    expect(removeStepAndLinks(connected, 'smelt').links).toHaveLength(0);
    expect(removeResourceAndLinks(connected, 'plate').links).toHaveLength(0);
  });
});
