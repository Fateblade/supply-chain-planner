import type { Plan } from './types';
import { newId } from './types';

/** Small electronics chain shown on first run so the app demonstrates itself. */
export function samplePlan(): Plan {
  const copperOre = newId();
  const ironOre = newId();
  const copperPlate = newId();
  const ironPlate = newId();
  const cable = newId();
  const circuit = newId();

  return {
    name: 'Electronics starter',
    resources: [
      { id: copperOre, name: 'Copper ore', isRaw: true },
      { id: ironOre, name: 'Iron ore', isRaw: true },
      { id: copperPlate, name: 'Copper plate', isRaw: false },
      { id: ironPlate, name: 'Iron plate', isRaw: false },
      { id: cable, name: 'Copper cable', isRaw: false },
      { id: circuit, name: 'Electronic circuit', isRaw: false },
    ],
    steps: [
      {
        id: newId(),
        name: 'Smelt copper',
        inputs: [{ resourceId: copperOre, amount: 1 }],
        outputs: [{ resourceId: copperPlate, amount: 1 }],
      },
      {
        id: newId(),
        name: 'Smelt iron',
        inputs: [{ resourceId: ironOre, amount: 1 }],
        outputs: [{ resourceId: ironPlate, amount: 1 }],
      },
      {
        id: newId(),
        name: 'Draw cable',
        inputs: [{ resourceId: copperPlate, amount: 1 }],
        outputs: [{ resourceId: cable, amount: 2 }],
      },
      {
        id: newId(),
        name: 'Assemble circuit',
        inputs: [
          { resourceId: cable, amount: 3 },
          { resourceId: ironPlate, amount: 1 },
        ],
        outputs: [{ resourceId: circuit, amount: 1 }],
      },
    ],
    targets: [{ resourceId: circuit, amount: 10 }],
  };
}
