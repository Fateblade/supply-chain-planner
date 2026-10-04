import type { Plan } from './types';

/** Matches the planning-field grid: node pitch and origin of defaultPosition. */
const COLUMN_GAP = 260;
const ROW_GAP = 190;
const ORIGIN_X = 150;
const ORIGIN_Y = 120;

/**
 * Arrange steps in layered columns following the flow of links:
 * sources on the left, each consumer one column right of its furthest
 * upstream producer, columns centered vertically. Steps without links
 * land in the leftmost column.
 */
export function autoLayout(plan: Plan): Plan {
  const incoming = new Map<string, string[]>();
  for (const link of plan.links ?? []) {
    const list = incoming.get(link.to.stepId) ?? [];
    if (!list.includes(link.from.stepId)) list.push(link.from.stepId);
    incoming.set(link.to.stepId, list);
  }

  // Longest-path layering; back-edges from production cycles are ignored
  // so the walk always terminates.
  const layer = new Map<string, number>();
  const onPath = new Set<string>();
  function layerOf(id: string): number {
    const cached = layer.get(id);
    if (cached !== undefined) return cached;
    if (onPath.has(id)) return 0;
    onPath.add(id);
    const upstream = incoming.get(id) ?? [];
    const value = upstream.length ? 1 + Math.max(...upstream.map(layerOf)) : 0;
    onPath.delete(id);
    layer.set(id, value);
    return value;
  }

  const columns = new Map<number, string[]>();
  for (const step of plan.steps) {
    const depth = layerOf(step.id);
    const ids = columns.get(depth) ?? [];
    ids.push(step.id);
    columns.set(depth, ids);
  }
  const maxRows = Math.max(...[...columns.values()].map((ids) => ids.length), 1);

  const positions = new Map<string, { x: number; y: number }>();
  for (const [depth, ids] of columns) {
    // Center shorter columns vertically against the tallest one.
    const yStart = ORIGIN_Y + ((maxRows - ids.length) * ROW_GAP) / 2;
    ids.forEach((id, row) => {
      positions.set(id, { x: ORIGIN_X + depth * COLUMN_GAP, y: yStart + row * ROW_GAP });
    });
  }

  return {
    ...plan,
    steps: plan.steps.map((step) => {
      const position = positions.get(step.id);
      return position ? { ...step, position } : step;
    }),
  };
}
